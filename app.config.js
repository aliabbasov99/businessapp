module.exports = ({ config }) => {
  const localApk = process.env.DASHBOARD_LOCAL_APK === '1';
  return {
    ...config,
    // A local test APK must keep its embedded JS instead of loading a remote OTA.
    updates: localApk ? { ...config.updates, enabled: false } : config.updates,
    plugins: [...(config.plugins ?? []), ['./plugins/with-local-apk.cjs', { enabled: localApk }]],
  };
};
