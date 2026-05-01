(function () {
  var THEME_OPTIONS = ['system', 'dark', 'light'];
  var LAST_VIEW_OPTIONS = ['splash', 'workbench'];

  function logPreferenceWarning(stage, err) {
    try {
      console.warn('[preferences] ' + stage, err);
    } catch (_consoleErr) {}
  }

  function readStoredString(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value == null ? fallback : String(value);
    } catch (err) {
      logPreferenceWarning('read localStorage failed: ' + key, err);
      return fallback;
    }
  }

  function writeStoredString(key, value) {
    try {
      localStorage.setItem(key, String(value == null ? '' : value));
      return true;
    } catch (err) {
      logPreferenceWarning('write localStorage failed: ' + key, err);
      return false;
    }
  }

  function getThemeMode() {
    var value = readStoredString('theme', 'system');
    return THEME_OPTIONS.indexOf(value) >= 0 ? value : 'system';
  }

  function setThemeMode(value) {
    var normalized = THEME_OPTIONS.indexOf(String(value || '')) >= 0 ? String(value) : 'system';
    return writeStoredString('theme', normalized);
  }

  function getLastView() {
    var value = readStoredString('sqldev_last_view', 'splash');
    return LAST_VIEW_OPTIONS.indexOf(value) >= 0 ? value : 'splash';
  }

  function setLastView(value) {
    var normalized = LAST_VIEW_OPTIONS.indexOf(String(value || '')) >= 0 ? String(value) : 'splash';
    return writeStoredString('sqldev_last_view', normalized);
  }

  function resolveTheme(mode) {
    if (mode === 'dark' || mode === 'light') return mode;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (err) {
      logPreferenceWarning('match media failed', err);
      return 'light';
    }
  }

  window.__SQDEV_PREFERENCES__ = Object.freeze({
    getLastView: getLastView,
    getThemeMode: getThemeMode,
    resolveTheme: resolveTheme,
    setLastView: setLastView,
    setThemeMode: setThemeMode
  });
})();
