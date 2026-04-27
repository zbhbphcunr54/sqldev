/* ===== splash.js — Splash Motion & Workbench Scrolling ===== */

/* Latin brand fonts load in <head>; Noto Sans SC is injected asynchronously to reduce first paint cost. */

(function () {
  var poster = document.getElementById('splash-poster');
  if (!poster) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var enterBtn = document.getElementById('sp-enter-btn');
  var themeBtn = document.getElementById('sp-theme-btn');
  var finalEnterBtn = null;
  var themeOrder = ['system', 'dark', 'light'];
  var VIEW_KEY = 'sqldev_last_view';
  var START_IN_WORKBENCH = window.__SQDEV_STARTUP_VIEW === 'workbench';
  var ROUTE_SPLASH = '#/splash';
  var ROUTE_WORKBENCH_PREFIX = '#/workbench';
  var ROUTE_WORKBENCH_DEFAULT = '#/workbench/ddl';
  var tokenIntervalId = 0;
  var tokenSeedTimeouts = [];
  var tokenStarted = false;
  var orbAnimationId = 0;
  var orbStarted = false;

  function normalizeHash(value) {
    var hash = String(value || '').trim();
    if (!hash) return '';
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    hash = hash.replace(/\/{2,}/g, '/');
    return hash;
  }

  function replaceHashRoute(hash, state) {
    var target = normalizeHash(hash);
    if (!target) return;
    try {
      var current = normalizeHash(window.location.hash || '');
      if (current === target) return;
      var nextUrl = window.location.pathname + window.location.search + target;
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(state || null, '', nextUrl);
      } else {
        window.location.hash = target.slice(1);
      }
    } catch (_err) {}
  }

  function ensureWorkbenchRoute() {
    var current = normalizeHash(window.location.hash || '');
    if (current.indexOf(ROUTE_WORKBENCH_PREFIX) === 0) return;
    replaceHashRoute(ROUTE_WORKBENCH_DEFAULT, { view: 'workbench', page: 'ddl' });
  }

  function ensureSplashRoute() {
    replaceHashRoute(ROUTE_SPLASH, { view: 'splash' });
  }

  function resolveTheme(mode) {
    if (window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.resolveTheme === 'function') {
      return window.__SQDEV_PREFERENCES__.resolveTheme(mode);
    }
    if (mode === 'dark' || mode === 'light') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function themeLabel(mode) {
    if (mode === 'dark') return '切换到亮色模式';
    if (mode === 'light') return '切换到跟随系统';
    return '切换到深色模式';
  }

  function updateThemeButton(mode) {
    if (!themeBtn) return;
    var nextLabel = themeLabel(mode);
    themeBtn.setAttribute('aria-label', nextLabel);
    themeBtn.setAttribute('title', nextLabel);
    themeBtn.setAttribute('data-mode', mode);
    themeBtn.setAttribute('data-resolved-theme', resolveTheme(mode));
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', resolveTheme(mode));
    updateThemeButton(mode);
  }

  function syncTheme(mode) {
    if (window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.setThemeMode === 'function') {
      window.__SQDEV_PREFERENCES__.setThemeMode(mode);
    } else {
      localStorage.setItem('theme', mode);
    }
    applyTheme(mode);
    window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: mode }));
  }

  function toggleTheme() {
    var current = window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
      ? window.__SQDEV_PREFERENCES__.getThemeMode()
      : (localStorage.getItem('theme') || 'system');
    var idx = themeOrder.indexOf(current);
    var next = themeOrder[(idx + 1) % themeOrder.length];
    syncTheme(next);
  }

  function setLastView(view) {
    if (window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.setLastView === 'function') {
      window.__SQDEV_PREFERENCES__.setLastView(view);
      return;
    }
    try { localStorage.setItem(VIEW_KEY, view); } catch (_err) {}
  }

  function clearTokenTimers() {
    if (tokenIntervalId) {
      clearInterval(tokenIntervalId);
      tokenIntervalId = 0;
    }
    for (var i = 0; i < tokenSeedTimeouts.length; i++) clearTimeout(tokenSeedTimeouts[i]);
    tokenSeedTimeouts = [];
    tokenStarted = false;
  }

  function stopOrbAnimation() {
    if (orbAnimationId) {
      cancelAnimationFrame(orbAnimationId);
      orbAnimationId = 0;
    }
    orbStarted = false;
  }

  function stopVisualEffects() {
    clearTokenTimers();
    stopOrbAnimation();
  }

  function enterWorkbench(skipMotion) {
    ensureWorkbenchRoute();
    setLastView('workbench');
    document.documentElement.classList.add('startup-workbench');
    stopVisualEffects();
    var savedTheme = window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
      ? window.__SQDEV_PREFERENCES__.getThemeMode()
      : (localStorage.getItem('theme') || 'system');
    applyTheme(savedTheme);
    window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: savedTheme }));
    poster.classList.add('leaving');
    if (skipMotion || prefersReducedMotion) {
      poster.style.display = 'none';
      document.body.classList.remove('splash-active');
      return;
    }
    window.setTimeout(function () {
      poster.style.display = 'none';
      document.body.classList.remove('splash-active');
    }, 520);
  }

  function showSplashHome() {
    ensureSplashRoute();
    setLastView('splash');
    document.documentElement.classList.remove('startup-workbench');
    applyTheme(
      window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
        ? window.__SQDEV_PREFERENCES__.getThemeMode()
        : (localStorage.getItem('theme') || 'system')
    );
    poster.style.display = '';
    poster.classList.remove('leaving');
    document.body.classList.add('splash-active');
    poster.scrollTop = 0;
    try {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'instant' });
    } catch (_err) {
      window.scrollTo(0, 0);
    }
    if (!prefersReducedMotion) {
      startTokenEffects();
      startOrbEffects();
    }
  }

  window.splashApi = Object.assign({}, window.splashApi || {}, {
    showHome: showSplashHome,
    enterWorkbench: enterWorkbench
  });

  if (START_IN_WORKBENCH) {
    enterWorkbench(true);
  }

  applyTheme(
    window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
      ? window.__SQDEV_PREFERENCES__.getThemeMode()
      : (localStorage.getItem('theme') || 'system')
  );
  try {
    var themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    themeMedia.addEventListener('change', function () {
      var currentTheme = window.__SQDEV_PREFERENCES__ && typeof window.__SQDEV_PREFERENCES__.getThemeMode === 'function'
        ? window.__SQDEV_PREFERENCES__.getThemeMode()
        : (localStorage.getItem('theme') || 'system');
      if (currentTheme === 'system') {
        applyTheme('system');
        window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: 'system' }));
      }
    });
  } catch (_themeErr) {}

  /* Floating SQL tokens */
  var keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN', 'INDEX', 'TABLE', 'VIEW', 'TRIGGER', 'CURSOR', 'BEGIN', 'END', 'RETURN', 'DECLARE', 'NUMBER', 'VARCHAR2', 'CLOB', 'BOOLEAN'];
  var tokBox = poster.querySelector('.sp-tokens');
  function spawnTok() {
    if (!tokBox || !document.body.classList.contains('splash-active')) return;
    var el = document.createElement('span');
    el.className = 'sp-tok';
    el.textContent = keywords[Math.random() * keywords.length | 0];
    el.style.left = Math.random() * 100 + '%';
    el.style.bottom = '-30px';
    el.style.setProperty('--r', (Math.random() * 20 - 10) + 'deg');
    var dur = 12 + Math.random() * 16;
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (Math.random() * 4) + 's';
    tokBox.appendChild(el);
    setTimeout(function () { el.remove(); }, (dur + 4) * 1000);
  }
  function startTokenEffects() {
    if (!tokBox || tokenStarted) return;
    tokenStarted = true;
    for (var i = 0; i < 12; i++) {
      tokenSeedTimeouts.push(setTimeout(spawnTok, i * 380));
    }
    tokenIntervalId = setInterval(spawnTok, 2200);
  }
  if (tokBox && !prefersReducedMotion && !START_IN_WORKBENCH) {
    startTokenEffects();
  }

  /* Canvas ambient glow */
  var cvs = poster.querySelector('.sp-canvas');
  var ctx = cvs && cvs.getContext ? cvs.getContext('2d') : null;
  var orbs = null;
  function resizeCanvas() {
    if (!cvs) return;
    cvs.width = window.innerWidth;
    cvs.height = Math.max(window.innerHeight, poster.offsetHeight);
  }
  function drawOrbs() {
    if (!ctx || !orbs || !document.body.classList.contains('splash-active')) {
      orbAnimationId = 0;
      orbStarted = false;
      return;
    }
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      o.x += o.vx;
      o.y += o.vy;
      if (o.x < 0 || o.x > 1) o.vx *= -1;
      if (o.y < 0 || o.y > 1) o.vy *= -1;
      var g = ctx.createRadialGradient(o.x * cvs.width, o.y * cvs.height, 0, o.x * cvs.width, o.y * cvs.height, o.r);
      g.addColorStop(0, o.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
    orbAnimationId = requestAnimationFrame(drawOrbs);
  }
  function startOrbEffects() {
    if (!ctx || orbStarted) return;
    orbStarted = true;
    resizeCanvas();
    drawOrbs();
  }
  if (ctx && !prefersReducedMotion && !START_IN_WORKBENCH) {
    orbs = [
      { x: .24, y: .18, r: 280, color: 'rgba(79,125,249,0.11)', vx: .00016, vy: .00013 },
      { x: .78, y: .24, r: 220, color: 'rgba(139,92,246,0.09)', vx: -.00014, vy: .00017 },
      { x: .54, y: .48, r: 180, color: 'rgba(34,211,238,0.06)', vx: .00012, vy: -.0001 }
    ];
    window.addEventListener('resize', resizeCanvas);
    startOrbEffects();
  } else if (cvs) {
    cvs.style.display = 'none';
  }

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  if (enterBtn) enterBtn.addEventListener('click', enterWorkbench);
  window.addEventListener('auth:login-success', enterWorkbench);
})();
