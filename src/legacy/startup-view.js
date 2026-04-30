(function () {
  var root = document.documentElement;

  function resolveTheme(mode) {
    if (window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.resolveTheme === 'function') {
      return window.__SQDEV_PREFERENCES__.resolveTheme(mode);
    }
    if (mode === 'dark' || mode === 'light') return mode;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_err) {
      return 'light';
    }
  }
  try {
    var savedTheme = window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
      ? window.__SQDEV_PREFERENCES__.getThemeMode()
      : (localStorage.getItem('theme') || 'system');
    root.setAttribute('data-theme', resolveTheme(savedTheme));
  } catch (_err) {}
  if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', 'light');
  root.classList.add('startup-workbench');
  window.__SQDEV_STARTUP_VIEW = 'workbench';
})();
