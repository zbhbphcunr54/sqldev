(function () {
  var root = document.documentElement;
  var WORKBENCH_RE = /\/workbench(?:\/|$)/i;
  var SPLASH_RE = /\/splash(?:\/|$)/i;

  function logStartupWarning(stage, err) {
    try {
      console.warn('[startup-view] ' + stage, err);
    } catch (_consoleErr) {}
  }

  function normalizePath(path) {
    var value = String(path || '').trim();
    if (!value) return '/';
    if (value.charAt(0) !== '/') value = '/' + value;
    value = value.replace(/\/{2,}/g, '/');
    value = value.replace(/\/+$/, '');
    return value || '/';
  }

  function readHashPath() {
    try {
      var hash = String(window.location.hash || '').replace(/^#/, '');
      return normalizePath(hash);
    } catch (err) {
      logStartupWarning('read hash failed', err);
      return '/';
    }
  }

  function readPathname() {
    try {
      return normalizePath(window.location.pathname || '/');
    } catch (err) {
      logStartupWarning('read pathname failed', err);
      return '/';
    }
  }

  function resolveStartupView() {
    var hashPath = readHashPath();
    if (WORKBENCH_RE.test(hashPath)) return 'workbench';
    if (SPLASH_RE.test(hashPath)) return 'splash';

    var pathname = readPathname();
    if (WORKBENCH_RE.test(pathname)) return 'workbench';
    if (SPLASH_RE.test(pathname)) return 'splash';
    return 'splash';
  }

  function resolveTheme(mode) {
    if (window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.resolveTheme === 'function') {
      return window.__SQDEV_PREFERENCES__.resolveTheme(mode);
    }
    if (mode === 'dark' || mode === 'light') return mode;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (err) {
      logStartupWarning('match media failed', err);
      return 'light';
    }
  }
  try {
    var savedTheme = window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
      ? window.__SQDEV_PREFERENCES__.getThemeMode()
      : (localStorage.getItem('theme') || 'system');
    root.setAttribute('data-theme', resolveTheme(savedTheme));
    if (resolveStartupView() === 'workbench') {
      root.classList.add('startup-workbench');
      window.__SQDEV_STARTUP_VIEW = 'workbench';
      return;
    }
  } catch (err) {
    logStartupWarning('resolve startup view failed', err);
  }
  if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', 'light');
  window.__SQDEV_STARTUP_VIEW = 'splash';
})();
