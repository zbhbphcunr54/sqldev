(function () {
  var ASSET_VERSION = window.__SQDEV_ASSET_VERSION || '20260415f';

  function assetUrl(path) {
    var p = String(path || '').replace(/^\.\//, '');
    return p + (p.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(ASSET_VERSION);
  }

  var coreCodemirror = 'vendor/codemirror.min.js';
  var codemirrorPlugins = [
    'vendor/sql.min.js',
    'vendor/placeholder.min.js',
    'vendor/active-line.min.js'
  ];
  var coreVue = 'vendor/vue.global.prod.js';
  var appDataScripts = [assetUrl('samples.js'), assetUrl('rules.js')];
  var appEntry = assetUrl('app.js');

  var started = false;
  var done = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.defer = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(el);
    });
  }

  function loadScriptsParallel(srcList) {
    return Promise.all(srcList.map(function (src) { return loadScript(src); }));
  }

  function loadQueue() {
    var codemirrorReady = loadScript(coreCodemirror);
    var vueReady = loadScript(coreVue);
    var appDataReady = loadScriptsParallel(appDataScripts);
    var pluginReady = codemirrorReady.then(function () { return loadScriptsParallel(codemirrorPlugins); });
    return Promise.all([vueReady, appDataReady, pluginReady]).then(function () {
      return loadScript(appEntry);
    });
  }

  function boot(reason) {
    if (started || done) return;
    started = true;
    window.__sqldevBootReason = reason || 'auto';
    loadQueue().then(function () {
      done = true;
      window.__sqldevBootDone = true;
    }).catch(function (err) {
      console.error('[bootstrap] lazy load failed:', err);
      done = false;
      started = false;
    });
  }

  function scheduleIdleBoot() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(function () { boot('idle'); }, { timeout: 5000 });
    } else {
      setTimeout(function () { boot('timeout'); }, 2500);
    }
  }

  window.__loadSqldevAppNow = function () { boot('manual'); };

  if (window.__SQDEV_STARTUP_VIEW === 'workbench' || document.documentElement.classList.contains('startup-workbench')) {
    boot('startup-workbench');
    return;
  }

  var enterBtn = document.getElementById('sp-enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('pointerdown', function () { boot('enter-btn'); }, { once: true, passive: true });
  } else {
    document.addEventListener('pointerdown', function () { boot('interaction'); }, { once: true, passive: true });
  }
  window.addEventListener('auth:login-success', function () { boot('auth-success'); }, { once: true });
  document.addEventListener('keydown', function () { boot('interaction'); }, { once: true });
  scheduleIdleBoot();
})();
