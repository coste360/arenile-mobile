// Expo config plugin (Android): Firebase Cloud Messaging stays dormant until
// the user turns push notifications on in the app (privacy ADR 0005, ADR
// 0011). Without this, FCM would register with Google and fetch a token at
// every app start; with it, a token exists only after the app asks for it
// (getDevicePushTokenAsync, called only after the user's opt-in). Analytics
// collection is also declared off: the app ships no Firebase Analytics, this
// makes sure nothing turns it on.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const META = {
  firebase_messaging_auto_init_enabled: 'false',
  firebase_analytics_collection_deactivated: 'true',
};

function withFcmPrivacy(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    for (const [name, value] of Object.entries(META)) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value);
    }
    return cfg;
  });
}

module.exports = withFcmPrivacy;
module.exports.META = META;
