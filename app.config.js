// app.config.js — build-time values a static app.json can't express.
// Expo loads app.json first and passes its "expo" object in as `config`.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  // Google Maps keys from the environment (EAS env vars or .env). app.json alone
  // writes the literal "$EXPO_PUBLIC_..." text into the manifest, so maps stay blank.
  const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
  const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY;
  if (androidMapsKey) config.android.config.googleMaps.apiKey = androidMapsKey;
  if (iosMapsKey) config.ios.config.googleMapsApiKey = iosMapsKey;

  // Firebase client config (Firebase project onedelivery-8d9fc) — Android needs
  // it to get a push token, so notifications only work in builds that include it.
  if (fs.existsSync(path.join(__dirname, "google-services.json"))) {
    config.android.googleServicesFile = "./google-services.json";
  } else {
    console.warn("[app.config] google-services.json not found — Android push notifications will not work in this build.");
  }

  return config;
};
