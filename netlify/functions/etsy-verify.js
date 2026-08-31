const { getStore } = require("@netlify/blobs");

const DEVICE_CAP = 2;
const FRIENDS_CAP = 10;

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function blobStore(name) {
  return getStore({
    name,
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

async function checkAndRecordDevice(store, key, deviceId, cap) {
  const existing = (await store.get(key, { type: "json" })) || { devices: [] };
  if (existing.devices.includes(deviceId)) {
    return { allowed: true };
  }
  if (existing.devices.length >= cap) {
    return { allowed: false };
  }
  existing.devices.push(deviceId);
  await store.setJSON(key, existing);
  return { allowed: true };
}

async function getFreshAccessToken(authStore) {
  const saved = await authStore.get("shop-refresh-token", { type: "json" });
  if (!saved || !saved.refresh_token) {
    throw new Error("No stored Etsy authorization found yet.");
  }
  const resp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_API_KEY,
      refresh_token: saved.refresh_token,
    }).toString(),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error("Failed to refresh Etsy access token: " + JSON.stringify(data));
  }
  // Save whatever comes back -- some OAuth providers rotate refresh tokens
  // on each use, some don't. Saving unconditionally is safe either way.
  await authStore.setJSON("shop-refresh-token", {
    refresh_token: data.refresh_token || saved.refresh_token,
    access_token: data.access_token,
    obtained_at: Date.now(),
    expires_in: data.expires_in,
  });
  return data.access_token;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { valid: false, message: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { valid: false, message: "Invalid request." });
  }

  const code = (body.code || "").trim();
  const deviceId = (body.deviceId || "").trim();

  if (!code) {
    return json(400, { valid: false, message: "Please enter a code." });
  }
  if (!deviceId) {
    return json(400, { valid: false, message: "Missing device identifier." });
  }

  const devicesStore = blobStore("device-activations");

  const normalize = (s) => (s || "").toUpperCase().replace(/[\s-]/g, "");
  const normalizedCode = normalize(code);

  // 1. Owner override -- always works, never touches Etsy, never capped.
  if (
    process.env.OWNER_ACCESS_CODE &&
    normalizedCode === normalize(process.env.OWNER_ACCESS_CODE)
  ) {
    return json(200, { valid: true, reason: "owner" });
  }

  // 2. Friends & family code -- fixed shared code, its own generous cap.
  if (
    process.env.FRIENDS_ACCESS_CODE &&
    normalizedCode === normalize(process.env.FRIENDS_ACCESS_CODE)
  ) {
    const result = await checkAndRecordDevice(devicesStore, "friends-family", deviceId, FRIENDS_CAP);
    if (!result.allowed) {
      return json(200, {
        valid: false,
        message: "This friends & family code has reached its device limit.",
      });
    }
    return json(200, { valid: true, reason: "friends" });
  }

  // 3. Otherwise, treat it as a real Etsy receipt number.
  const shopId = process.env.ETSY_SHOP_ID;
  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;

  if (!shopId || !apiKey || !sharedSecret) {
    console.error("Missing one of ETSY_SHOP_ID / ETSY_API_KEY / ETSY_SHARED_SECRET.");
    return json(200, {
      valid: false,
      message: "Verification isn't fully set up yet. Please try again shortly.",
    });
  }

  let accessToken;
  try {
    const authStore = blobStore("etsy-auth");
    accessToken = await getFreshAccessToken(authStore);
  } catch (err) {
    console.error("Could not get fresh Etsy access token:", err.message);
    return json(200, {
      valid: false,
      message: "We couldn't verify that right now. Please try again in a few minutes.",
    });
  }

  try {
    const receiptResp = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/receipts/${encodeURIComponent(code)}`,
      {
        headers: {
          "x-api-key": `${apiKey}:${sharedSecret}`,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (receiptResp.status === 404) {
      return json(200, {
        valid: false,
        message: "We couldn't find an order with that number. Please double-check it and try again.",
      });
    }
    if (!receiptResp.ok) {
      const errBody = await receiptResp.text();
      console.error("Etsy receipt lookup failed:", receiptResp.status, errBody);
      return json(200, {
        valid: false,
        message: "We couldn't verify that right now. Please try again in a few minutes.",
      });
    }
    // A 200 response means the receipt exists and belongs to this shop --
    // that alone is a strong, hard-to-fake signal of a genuine order.
  } catch (err) {
    console.error("Error calling Etsy receipts API:", err.message);
    return json(200, {
      valid: false,
      message: "We couldn't verify that right now. Please try again in a few minutes.",
    });
  }

  const result = await checkAndRecordDevice(devicesStore, `receipt-${code}`, deviceId, DEVICE_CAP);
  if (!result.allowed) {
    return json(200, {
      valid: false,
      message: "This order has already been activated on its maximum number of devices.",
    });
  }

  return json(200, { valid: true, reason: "etsy" });
};
