const { getStore } = require("@netlify/blobs");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function page(title, message, ok) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;background:#fffaf2;color:#35473f;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{max-width:420px;text-align:center;background:#fff;border:1px solid #dfe8dc;border-radius:16px;padding:32px 24px;box-shadow:0 6px 18px rgba(15,36,55,.08)}
  h1{font-size:20px;color:${ok ? "#4b9460" : "#bd654f"};margin:0 0 12px}
  p{font-size:14px;line-height:1.5;color:#556}
  .emoji{font-size:40px;margin-bottom:8px}</style></head>
  <body><div class="card"><div class="emoji">${ok ? "🐞✅" : "⚠️"}</div><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);

  // Etsy sends back an error param if the shop owner declines, or something goes wrong.
  if (params.error) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: page(
        "Authorization was not completed",
        `Etsy reported: "${params.error_description || params.error}". You can close this tab and try the authorization link again whenever you're ready.`,
        false
      ),
    };
  }

  if (!params.code || !params.state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: page(
        "Something's missing",
        "Etsy didn't send back the information this page needs. Please try the authorization link again from the start.",
        false
      ),
    };
  }

  // CSRF check: the state Etsy sends back must match the one we generated and stored.
  if (!cookies.etsy_oauth_state || cookies.etsy_oauth_state !== params.state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: page(
        "This link has expired or doesn't match",
        "For your security, this authorization link can only be used once and must be completed in the same browser it started in. Please start the authorization process again.",
        false
      ),
    };
  }

  const codeVerifier = cookies.etsy_code_verifier;
  if (!codeVerifier) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: page(
        "This link has expired",
        "The authorization window (10 minutes) has passed, or this was opened in a different browser than it started in. Please start the authorization process again.",
        false
      ),
    };
  }

  const apiKey = process.env.ETSY_API_KEY;
  const redirectUri =
    "https://lucky-ladybug-garden.netlify.app/.netlify/functions/etsy-callback";

  try {
    const tokenResp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: apiKey,
        redirect_uri: redirectUri,
        code: params.code,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || !tokenData.access_token) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: page(
          "Etsy declined the request",
          `Etsy responded with: "${tokenData.error_description || tokenData.error || "an unknown error"}". Double-check that the redirect URI registered in your Etsy app settings matches exactly, then try again.`,
          false
        ),
      };
    }

    // access_token from Etsy is formatted "{user_id}.{token}" -- the leading
    // number is your own Etsy user ID, useful later, not a secret by itself.
    const store = getStore("etsy-auth");
    await store.setJSON("shop-refresh-token", {
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      obtained_at: Date.now(),
      expires_in: tokenData.expires_in,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      multiValueHeaders: {
        // Multiple same-name headers (two Set-Cookie values) must go here,
        // not under `headers`, which only supports one value per key.
        "Set-Cookie": [
          "etsy_code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
          "etsy_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        ],
      },
      body: page(
        "You're connected!",
        "Lucky Ladybug Garden is now authorized to check Etsy order numbers for you. You won't need to do this again — you can close this tab.",
        true
      ),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: page(
        "Something went wrong",
        "There was a problem finishing the connection to Etsy. Please try the authorization link again in a few minutes.",
        false
      ),
    };
  }
};
