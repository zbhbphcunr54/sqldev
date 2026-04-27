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
      toLegacyPath(resolveAsset('supabase-config.js')),
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
      return loadScript(assets.authStack[3]);
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

  function scheduleIdleBoot() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(function () { boot('idle'); }, { timeout: 5000 });
      window.requestIdleCallback(function () { loadAuthStack('idle-auth').catch(function () {}); }, { timeout: 9000 });
    } else {
      setTimeout(function () { boot('timeout'); }, 2500);
      setTimeout(function () { loadAuthStack('timeout-auth').catch(function () {}); }, 4200);
    }
  }

  function bindAuthIntent() {
    function onAuthIntent() {
      loadAuthStack('auth-intent').then(function () {
        if (window.authApi && typeof window.authApi.openAuthModal === 'function') {
          window.authApi.openAuthModal();
        }
      }).catch(function () {});
    }
    var splashTopBtn = document.getElementById('sp-auth-top-btn');
    var splashHeroBtn = document.getElementById('sp-auth-hero-btn');
    var feedbackFab = document.getElementById('feedback-fab');
    if (splashTopBtn) splashTopBtn.addEventListener('click', onAuthIntent);
    if (splashHeroBtn) splashHeroBtn.addEventListener('click', onAuthIntent);
    if (feedbackFab) {
      feedbackFab.addEventListener('click', function () {
        if (typeof window.openFeedbackModal === 'function') return;
        loadAuthStack('feedback-intent').then(function () {
          if (typeof window.openFeedbackModal === 'function') window.openFeedbackModal('splash-fab');
        }).catch(function () {});
      });
    }
  }

  window.__loadSqldevAppNow = function () { boot('manual'); };
  window.__loadSqldevAuthNow = function () { return loadAuthStack('manual'); };

  bindAuthIntent();

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
