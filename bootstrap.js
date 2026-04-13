(function () {
  var queue = [
    'vendor/codemirror.min.js',
    'vendor/sql.min.js',
    'vendor/placeholder.min.js',
    'vendor/active-line.min.js',
    'vendor/vue.global.prod.js',
    'samples.js',
    'rules.js',
    'app.js?v=20260413b'
  ];

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

  function loadQueue() {
    return queue.reduce(function (p, src) {
      return p.then(function () { return loadScript(src); });
    }, Promise.resolve());
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
      window.requestIdleCallback(function () { boot('idle'); }, { timeout: 1200 });
    } else {
      setTimeout(function () { boot('timeout'); }, 300);
    }
  }

  window.__loadSqldevAppNow = function () { boot('manual'); };

  document.addEventListener('pointerdown', function () { boot('interaction'); }, { once: true, passive: true });
  document.addEventListener('keydown', function () { boot('interaction'); }, { once: true });
  scheduleIdleBoot();
})();
