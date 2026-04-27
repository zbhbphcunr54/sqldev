(function () {
  var THEME_OPTIONS = ['system', 'dark', 'light'];
  var LAST_VIEW_OPTIONS = ['splash', 'workbench'];

  function readStoredString(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value == null ? fallback : String(value);
    } catch (_err) {
      return fallback;
    }
  }

  function writeStoredString(key, value) {
    try {
      localStorage.setItem(key, String(value == null ? '' : value));
      return true;
    } catch (_err) {
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
    } catch (_err) {
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
