// app.config.js — build-time values a static app.json can't express.
// Expo loads app.json first and passes its "expo" object in as `config`.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  config.extra = config.extra || {};

  // Google Maps keys from the environment (EAS env vars or .env). app.json alone
  // writes the literal "$EXPO_PUBLIC_..." text into the manifest, so maps stay blank.
  const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
  const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY;
  if (androidMapsKey) config.android.config.googleMaps.apiKey = androidMapsKey;
  if (iosMapsKey) config.ios.config.googleMapsApiKey = iosMapsKey;

  // Firebase client config — Android needs it for push tokens, and it carries the
  // OAuth "Web client" ID that Google sign-in uses (present once Google sign-in is
  // enabled under Firebase → Authentication before downloading the file).
  const gsPath = path.join(__dirname, "google-services.json");
  if (fs.existsSync(gsPath)) {
    config.android.googleServicesFile = "./google-services.json";
    const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
    const oauthClients = [
      ...gs.client.flatMap((c) => c.oauth_client || []),
      ...gs.client.flatMap((c) => c.services?.appinvite_service?.other_platform_oauth_client || []),
    ];
    const webClient = oauthClients.find((o) => o.client_type === 3);
    if (webClient) config.extra.googleWebClientId = webClient.client_id;
  } else {
    console.warn("[app.config] google-services.json not found — Android push notifications will not work in this build.");
  }
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) config.extra.googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  return config;
};
