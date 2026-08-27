const crypto = require("crypto");

exports.handler = async function () {
  const apiKey = process.env.ETSY_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: "ETSY_API_KEY is not configured."
    };
  }

  // Etsy OAuth requires PKCE.
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const state = crypto.randomBytes(16).toString("hex");

  const redirectUri =
    "https://lucky-ladybug-garden.netlify.app/.netlify/functions/etsy-callback";

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "transactions_r",
    client_id: apiKey,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  return {
    statusCode: 302,
    headers: {
      Location: `https://www.etsy.com/oauth/connect?${params.toString()}`,
      "Set-Cookie": [
        `etsy_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        `etsy_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      ]
    },
    body: ""
  };
};
