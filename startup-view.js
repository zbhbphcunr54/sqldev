(function () {
  var KEY = 'sqldev_last_view';
  var root = document.documentElement;
  try {
    if (window.localStorage && localStorage.getItem(KEY) === 'workbench') {
      root.classList.add('startup-workbench');
      window.__SQDEV_STARTUP_VIEW = 'workbench';
      return;
    }
  } catch (_err) {}
  window.__SQDEV_STARTUP_VIEW = 'splash';
})();
