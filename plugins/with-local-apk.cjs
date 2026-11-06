const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = (config, { enabled = false } = {}) => withAndroidManifest(config, mod => {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
  if (enabled) {
    const url = new URL(process.env.EXPO_PUBLIC_API_URL);
    // Only the local APK allows the computer's HTTP API. Cloud builds retain defaults.
    if (url.protocol === 'http:') application.$['android:usesCleartextTraffic'] = 'true';
    else delete application.$['android:usesCleartextTraffic'];
  } else {
    delete application.$['android:usesCleartextTraffic'];
  }
  return mod;
});
