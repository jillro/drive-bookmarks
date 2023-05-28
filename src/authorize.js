(async function () {
  const CLIENT_ID =
    "763786585544-saa0h7ea1tj228bfo66tpn006c12r4og.apps.googleusercontent.com";

  function extractToken(redirectUri) {
    const m = redirectUri.match(/[#?](.*)/);
    if (!m || m.length < 1) return null;
    const params = new URLSearchParams(m[1].split("#")[0]);
    return params.get("access_token");
  }

  async function getToken() {
    const redirectSubdomain = browser.identity
      .getRedirectURL()
      .replace("https://", "")
      .replace(".extensions.allizom.org/", "");
    // 5e0fc0fb54319a968636d09b66c38ef0c5942ebb
    const redirectUri = "http://127.0.0.1/mozoauth2/" + redirectSubdomain;

    const url = await browser.identity.launchWebAuthFlow({
      interactive: true,
      url:
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        "client_id=" +
        CLIENT_ID +
        "&response_type=token" +
        "&scope=https://www.googleapis.com/auth/drive.metadata.readonly&" +
        "&redirect_uri=" +
        redirectUri,
    });

    return extractToken(url);
  }

  window.oauthLogin = async function () {
    let token = (await browser.storage.local.get("token")).token;

    if (typeof token === "string") {
      console.log("Token already exists (" + token + ")");
    } else {
      token = await getToken();
      if (!token) {
        console.log("Failed to extract token from redirect URI");
        return;
      }

      console.log("Got new token: " + token);
    }

    // Validate token
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + token
    );
    const data = await res.json();
    if (data.aud !== CLIENT_ID) {
      console.log(
        "Token client ID" + data.aud + " does not match app client ID"
      );
      await browser.storage.local.remove("token");
      return;
    }

    // Save token
    await browser.storage.local.set({ token });
    return token;
  };
})();
