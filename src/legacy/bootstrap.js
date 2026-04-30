(function () {
  var LEGACY_BASE = 'src/legacy/';
  var ASSET_MANIFEST = (window.__SQDEV_ASSET_MANIFEST && typeof window.__SQDEV_ASSET_MANIFEST === 'object')
    ? window.__SQDEV_ASSET_MANIFEST
    : null;
  var scriptPromiseMap = Object.create(null);
  var authLoadingPromise = null;
  var authReady = false;
  var started = false;
  var done = false;

  function logDeferredError(scope, err) {
    if (!err) return;
    console.warn('[bootstrap] ' + scope + ' failed:', err);
  }

  function resolveAsset(path) {
    if (!ASSET_MANIFEST) return path;
    var mapped = ASSET_MANIFEST[path];
    return (typeof mapped === 'string' && mapped.trim()) ? mapped : path;
  }

  function toLegacyPath(path) {
    var value = String(path || '').trim();
    if (!value) return value;
    if (/^(https?:)?\/\//i.test(value) || value.charAt(0) === '/') return value;
    if (value.indexOf(LEGACY_BASE) === 0) return value;
    return LEGACY_BASE + value;
  }

  var assets = {
    appEntry: toLegacyPath(resolveAsset('app.js')),
    appData: [toLegacyPath(resolveAsset('samples.js')), toLegacyPath(resolveAsset('rules.js'))],
    coreCodemirror: toLegacyPath('vendor/codemirror.min.js'),
    codemirrorPlugins: [
      toLegacyPath('vendor/sql.min.js'),
      toLegacyPath('vendor/placeholder.min.js'),
      toLegacyPath('vendor/active-line.min.js')
    ],
    coreVue: toLegacyPath('vendor/vue.global.prod.js'),
    authStack: [
      toLegacyPath('vendor/supabase.js'),
      toLegacyPath(resolveAsset('auth.js')),
      toLegacyPath(resolveAsset('feedback.js'))
    ]
  };

  function loadScript(src) {
    var key = String(src || '').trim();
    if (!key) return Promise.reject(new Error('Empty script src'));
    if (scriptPromiseMap[key]) return scriptPromiseMap[key];
    scriptPromiseMap[key] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + key + '"]');
      if (existing && existing.dataset && existing.dataset.loaded === '1') {
        resolve();
        return;
      }
      var el = existing || document.createElement('script');
      el.src = key;
      el.defer = true;
      el.onload = function () {
        if (el.dataset) el.dataset.loaded = '1';
        resolve();
      };
      el.onerror = function () { reject(new Error('Failed to load ' + key)); };
      if (!existing) document.body.appendChild(el);
    });
    return scriptPromiseMap[key];
  }

  function loadScriptsParallel(srcList) {
    return Promise.all((srcList || []).map(function (src) { return loadScript(src); }));
  }

  function waitForRuntimeConfig() {
    if (window.__SQDEV_SUPABASE_URL || window.SUPABASE_URL) return Promise.resolve();
    return new Promise(function (resolve) {
      var startedAt = Date.now();
      var timer = setInterval(function () {
        if (window.__SQDEV_SUPABASE_URL || window.SUPABASE_URL || Date.now() - startedAt > 2500) {
          clearInterval(timer);
          resolve();
        }
      }, 25);
    });
  }

  function loadAuthStack(reason) {
    if (authReady) return Promise.resolve();
    if (authLoadingPromise) return authLoadingPromise;
    window.__sqldevAuthLoadReason = reason || 'auto';
    authLoadingPromise = waitForRuntimeConfig().then(function () {
      return loadScript(assets.authStack[0]);
    }).then(function () {
      return loadScript(assets.authStack[1]);
    }).then(function () {
      return loadScript(assets.authStack[2]);
    }).then(function () {
      authReady = true;
      window.__sqldevAuthReady = true;
    }).catch(function (err) {
      authLoadingPromise = null;
      throw err;
    });
    return authLoadingPromise;
  }

  function loadQueue() {
    var codemirrorReady = loadScript(assets.coreCodemirror);
    var vueReady = loadScript(assets.coreVue);
    var appDataReady = loadScriptsParallel(assets.appData);
    var pluginReady = codemirrorReady.then(function () { return loadScriptsParallel(assets.codemirrorPlugins); });
    return Promise.all([vueReady, appDataReady, pluginReady]).then(function () {
      return loadScript(assets.appEntry);
    });
  }

  function boot(reason) {
    if (started || done) return;
    started = true;
    window.__sqldevBootReason = reason || 'auto';
    loadAuthStack('boot').catch(function (err) {
      console.warn('[bootstrap] auth stack load failed:', err);
    });
    loadQueue().then(function () {
      done = true;
      window.__sqldevBootDone = true;
    }).catch(function (err) {
      console.error('[bootstrap] lazy load failed:', err);
      done = false;
      started = false;
    });
  }

  window.__loadSqldevAppNow = function () { boot('manual'); };
  window.__loadSqldevAuthNow = function () { return loadAuthStack('manual'); };

  boot('startup-workbench');
})();
