/* ===== splash.js — Splash Motion & Workbench Scrolling ===== */

/* Font activation no longer needed — fonts load synchronously via <link rel="stylesheet"> */

(function () {
  var poster = document.getElementById('splash-poster');
  if (!poster) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var enterBtn = document.getElementById('sp-enter-btn');
  var themeBtn = document.getElementById('sp-theme-btn');
  var finalEnterBtn = null;
  var themeOrder = ['system', 'dark', 'light'];

  function resolveTheme(mode) {
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
    localStorage.setItem('theme', mode);
    applyTheme(mode);
    window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: mode }));
  }

  function toggleTheme() {
    var current = localStorage.getItem('theme') || 'system';
    var idx = themeOrder.indexOf(current);
    var next = themeOrder[(idx + 1) % themeOrder.length];
    syncTheme(next);
  }

  function enterWorkbench() {
    var savedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(savedTheme);
    window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: savedTheme }));
    poster.classList.add('leaving');
    if (prefersReducedMotion) {
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
    applyTheme(localStorage.getItem('theme') || 'system');
    poster.style.display = '';
    poster.classList.remove('leaving');
    document.body.classList.add('splash-active');
    poster.scrollTop = 0;
    try {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'instant' });
    } catch (_err) {
      window.scrollTo(0, 0);
    }
  }

  window.splashApi = Object.assign({}, window.splashApi || {}, {
    showHome: showSplashHome,
    enterWorkbench: enterWorkbench
  });

  applyTheme(localStorage.getItem('theme') || 'system');
  try {
    var themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    themeMedia.addEventListener('change', function () {
      if ((localStorage.getItem('theme') || 'system') === 'system') {
        applyTheme('system');
        window.dispatchEvent(new CustomEvent('sp-theme-sync', { detail: 'system' }));
      }
    });
  } catch (_themeErr) {}

  /* Floating SQL tokens */
  var keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN', 'INDEX', 'TABLE', 'VIEW', 'TRIGGER', 'CURSOR', 'BEGIN', 'END', 'RETURN', 'DECLARE', 'NUMBER', 'VARCHAR2', 'CLOB', 'BOOLEAN'];
  var tokBox = poster.querySelector('.sp-tokens');
  if (tokBox && !prefersReducedMotion) {
    function spawnTok() {
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
    for (var i = 0; i < 12; i++) setTimeout(spawnTok, i * 380);
    setInterval(spawnTok, 2200);
  }

  /* Canvas ambient glow */
  var cvs = poster.querySelector('.sp-canvas');
  var ctx = cvs && cvs.getContext ? cvs.getContext('2d') : null;
  if (ctx && !prefersReducedMotion) {
    var orbs = [
      { x: .24, y: .18, r: 280, color: 'rgba(79,125,249,0.11)', vx: .00016, vy: .00013 },
      { x: .78, y: .24, r: 220, color: 'rgba(139,92,246,0.09)', vx: -.00014, vy: .00017 },
      { x: .54, y: .48, r: 180, color: 'rgba(34,211,238,0.06)', vx: .00012, vy: -.0001 }
    ];
    function resizeCanvas() {
      cvs.width = window.innerWidth;
      cvs.height = Math.max(window.innerHeight, poster.offsetHeight);
    }
    function drawOrbs() {
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
      requestAnimationFrame(drawOrbs);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    drawOrbs();
  } else if (cvs) {
    cvs.style.display = 'none';
  }

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  if (enterBtn) enterBtn.addEventListener('click', enterWorkbench);
  window.addEventListener('auth:login-success', enterWorkbench);
})();
