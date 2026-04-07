(function () {
  var supabaseGlobal = window.supabase;
  var projectUrl = window.SUPABASE_URL;
  var anonKey = window.SUPABASE_ANON_KEY;

  var authModalMask = document.getElementById('auth-modal-mask');
  var authStatus = document.getElementById('auth-status');
  var authEmail = document.getElementById('auth-email');
  var authPassword = document.getElementById('auth-password');
  var authCode = document.getElementById('auth-code');
  var authLoginBtn = document.getElementById('auth-login-btn');
  var authRegisterBtn = document.getElementById('auth-register-btn');
  var authCloseBtn = document.getElementById('auth-close-btn');
  var authModePasswordBtn = document.getElementById('auth-mode-password-btn');
  var authModeCodeBtn = document.getElementById('auth-mode-code-btn');
  var authPasswordWrap = document.getElementById('auth-password-wrap');
  var authCodeWrap = document.getElementById('auth-code-wrap');

  var splashAuthBtn = document.getElementById('sp-auth-top-btn');
  var splashEnterBtn = document.getElementById('sp-enter-btn');
  var appAuthBtn = document.getElementById('app-auth-btn');
  var appUserPop = document.getElementById('app-user-pop');
  var appUserBtn = document.getElementById('app-user-btn');
  var appUserMenu = document.getElementById('app-user-menu');
  var appUserEmail = document.getElementById('app-user-email');

  var user = null;
  var accessToken = '';
  var listeners = [];
  var sb = null;
  var authMode = 'password';
  var passwordRegistering = false;

  function ensureGlobalModalHost() {
    if (!authModalMask) return;
    var parent = authModalMask.parentElement;
    if (parent && parent.id === 'splash-poster') {
      document.body.appendChild(authModalMask);
    }
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) listeners[i](user);
    window.dispatchEvent(new CustomEvent('auth:state-changed', { detail: { user: user } }));
  }

  function setStatus(text, isError) {
    if (!authStatus) return;
    authStatus.textContent = text || '';
    authStatus.classList.toggle('error', !!isError);
  }

  function normalizeToken(token) {
    return (token || '').replace(/\s+/g, '').trim();
  }

  function getEmail() {
    if (!user) return '';
    return (user.email || '').trim();
  }

  function setBusy(busy) {
    if (authLoginBtn) authLoginBtn.disabled = busy;
    if (authRegisterBtn) authRegisterBtn.disabled = busy;
    if (authEmail) authEmail.disabled = busy;
    if (authPassword) authPassword.disabled = busy;
    if (authCode) authCode.disabled = busy;
    if (authModePasswordBtn) authModePasswordBtn.disabled = busy;
    if (authModeCodeBtn) authModeCodeBtn.disabled = busy;
  }

  function setAuthMode(mode) {
    authMode = mode === 'code' ? 'code' : 'password';

    var passwordMode = authMode === 'password';
    if (authModePasswordBtn) {
      authModePasswordBtn.classList.toggle('active', passwordMode);
      authModePasswordBtn.setAttribute('aria-selected', passwordMode ? 'true' : 'false');
    }
    if (authModeCodeBtn) {
      authModeCodeBtn.classList.toggle('active', !passwordMode);
      authModeCodeBtn.setAttribute('aria-selected', passwordMode ? 'false' : 'true');
    }
    if (authPasswordWrap) authPasswordWrap.hidden = !passwordMode;
    if (authCodeWrap) authCodeWrap.hidden = passwordMode;

    if (authRegisterBtn) authRegisterBtn.textContent = passwordMode ? '密码注册' : '发送验证码';
    if (authLoginBtn) authLoginBtn.textContent = passwordMode ? '密码登录' : '验证码登录';

    setStatus('', false);
  }

  function updatePosterCta() {
    var loggedIn = !!user;
    if (splashEnterBtn) splashEnterBtn.textContent = loggedIn ? '进入工作台' : '登录后进入工作台';
    if (splashAuthBtn) splashAuthBtn.textContent = loggedIn ? '退出登录' : '注册 / 登录';
    if (appUserPop) appUserPop.hidden = !loggedIn;
    if (!loggedIn && appUserPop) appUserPop.classList.remove('is-open');
    if (!loggedIn && appUserMenu) appUserMenu.hidden = true;
    if (appAuthBtn) appAuthBtn.textContent = '退出登录';
    if (appUserEmail) appUserEmail.textContent = getEmail();
    if (appUserBtn) appUserBtn.title = getEmail() || '用户信息';
  }

  function closeUserMenu() {
    if (appUserPop) appUserPop.classList.remove('is-open');
    if (appUserMenu) appUserMenu.hidden = true;
  }

  function toggleUserMenu() {
    if (!appUserPop || !appUserMenu) return;
    var willOpen = !appUserPop.classList.contains('is-open');
    appUserMenu.hidden = !willOpen;
    appUserPop.classList.toggle('is-open', willOpen);
    if (appUserBtn) appUserBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function openAuthModal(message) {
    ensureGlobalModalHost();
    if (!authModalMask) return;
    authModalMask.hidden = false;
    setStatus(message || '', false);
    if (authEmail && !authEmail.value) {
      authEmail.focus();
      return;
    }
    if (authMode === 'password' && authPassword) {
      authPassword.focus();
      return;
    }
    if (authMode === 'code' && authCode) authCode.focus();
  }

  function closeAuthModal() {
    if (!authModalMask) return;
    authModalMask.hidden = true;
    setStatus('', false);
  }

  async function syncSession() {
    if (!sb) return;
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    accessToken = session && session.access_token ? session.access_token : '';
    user = session && session.user ? session.user : null;
    updatePosterCta();
    emit();
  }

  async function sendEmailCode(email) {
    var redirectTo = window.location.origin + window.location.pathname;
    return sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo
      }
    });
  }

  async function verifyEmailCode(email, token) {
    return sb.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email'
    });
  }

  async function registerWithPassword(email, password) {
    return sb.auth.signUp({
      email: email,
      password: password
    });
  }

  async function loginWithPassword(email, password) {
    return sb.auth.signInWithPassword({
      email: email,
      password: password
    });
  }

  async function signOut() {
    if (!sb) return { error: null };
    var res = await sb.auth.signOut();
    user = null;
    accessToken = '';
    if (authCode) authCode.value = '';
    updatePosterCta();
    emit();
    return res;
  }

  function getUserSync() {
    return user;
  }

  function getAccessToken() {
    return accessToken;
  }

  function onUserChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  async function init() {
    ensureGlobalModalHost();
    if (!supabaseGlobal || !supabaseGlobal.createClient) {
      setStatus('Supabase SDK 未加载', true);
      return;
    }
    if (!projectUrl || projectUrl.indexOf('YOUR_PROJECT_ID') >= 0 || !anonKey || anonKey.indexOf('YOUR_SUPABASE') >= 0) {
      setStatus('请先在 supabase-config.js 配置项目 URL 和 anon key', true);
      updatePosterCta();
      return;
    }

    sb = supabaseGlobal.createClient(projectUrl, anonKey);
    await syncSession();

    sb.auth.onAuthStateChange(function (_event, session) {
      accessToken = session && session.access_token ? session.access_token : '';
      user = session && session.user ? session.user : null;
      updatePosterCta();
      emit();

      if (user && !passwordRegistering) {
        if (authCode) authCode.value = '';
        closeAuthModal();
        window.dispatchEvent(new CustomEvent('auth:login-success', { detail: { user: user } }));
      }
    });
  }

  async function submitRegister() {
    if (!sb) return setStatus('认证未初始化，请检查 Supabase 配置', true);
    var email = (authEmail && authEmail.value || '').trim();
    if (!email) return setStatus('请输入邮箱', true);

    if (authMode === 'password') {
      var password = (authPassword && authPassword.value || '').trim();
      if (!password) return setStatus('请输入密码', true);
      if (password.length < 6) return setStatus('密码至少 6 位', true);

      setBusy(true);
      setStatus('正在注册账号...');
      passwordRegistering = true;
      try {
        var registerRes = await registerWithPassword(email, password);
        if (registerRes.error) throw registerRes.error;
        await sb.auth.signOut();
        user = null;
        accessToken = '';
        updatePosterCta();
        emit();
        if (authPassword) authPassword.value = '';
        setStatus('注册成功，请重新输入密码后点击“密码登录”进入', false);
        if (authPassword) authPassword.focus();
      } catch (err1) {
        setStatus(err1.message || '注册失败', true);
      } finally {
        passwordRegistering = false;
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setStatus('正在发送验证码...');
    try {
      var codeRes = await sendEmailCode(email);
      if (codeRes.error) throw codeRes.error;
      setStatus('验证码已发送，请输入验证码后点击“验证码登录”', false);
      if (authCode) authCode.focus();
    } catch (err2) {
      setStatus(err2.message || '发送验证码失败', true);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin() {
    if (!sb) return setStatus('认证未初始化，请检查 Supabase 配置', true);
    var email = (authEmail && authEmail.value || '').trim();
    if (!email) return setStatus('请输入邮箱', true);

    setBusy(true);
    if (authMode === 'password') setStatus('正在密码登录...');
    if (authMode === 'code') setStatus('正在验证验证码...');
    try {
      var res = null;
      if (authMode === 'password') {
        var password = (authPassword && authPassword.value || '').trim();
        if (!password) throw new Error('请输入密码');
        res = await loginWithPassword(email, password);
      } else {
        var token = normalizeToken(authCode && authCode.value);
        if (!token) throw new Error('请输入验证码');
        res = await verifyEmailCode(email, token);
      }
      if (res.error) throw res.error;
      setStatus('登录成功', false);
    } catch (err) {
      setStatus(err.message || '登录失败', true);
    } finally {
      setBusy(false);
    }
  }

  window.authApi = {
    init: init,
    signUp: registerWithPassword,
    signIn: loginWithPassword,
    sendEmailCode: sendEmailCode,
    verifyEmailCode: verifyEmailCode,
    signOut: signOut,
    getUserSync: getUserSync,
    getAccessToken: getAccessToken,
    onUserChange: onUserChange,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal
  };

  if (authModalMask) {
    authModalMask.addEventListener('click', function (e) {
      if (e.target === authModalMask) closeAuthModal();
    });
  }
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);

  if (authModePasswordBtn) {
    authModePasswordBtn.addEventListener('click', function () {
      setAuthMode('password');
      if (authPassword) authPassword.focus();
    });
  }
  if (authModeCodeBtn) {
    authModeCodeBtn.addEventListener('click', function () {
      setAuthMode('code');
      if (authCode) authCode.focus();
    });
  }

  if (splashAuthBtn) {
    splashAuthBtn.addEventListener('click', async function () {
      if (user) {
        await signOut();
        setStatus('', false);
        return;
      }
      openAuthModal('请选择登录方式并继续');
    });
  }

  if (appAuthBtn) {
    appAuthBtn.addEventListener('click', async function () {
      if (user) {
        await signOut();
      }
      closeUserMenu();
      window.location.reload();
    });
  }

  if (appUserBtn) {
    appUserBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (appUserPop && appUserPop.hidden) {
        openAuthModal('请先登录');
        return;
      }
      toggleUserMenu();
    });
  }

  if (appUserMenu) {
    appUserMenu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  document.addEventListener('pointerdown', function (e) {
    if (!appUserPop) return;
    if (appUserPop.contains(e.target)) return;
    closeUserMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && appUserPop) closeUserMenu();
  });

  if (authRegisterBtn) authRegisterBtn.addEventListener('click', submitRegister);
  if (authLoginBtn) authLoginBtn.addEventListener('click', submitLogin);

  if (authEmail) {
    authEmail.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (authMode === 'password' && authPassword) authPassword.focus();
      if (authMode === 'code' && authCode) authCode.focus();
    });
  }

  if (authPassword) {
    authPassword.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (authMode !== 'password') return;
      e.preventDefault();
      submitLogin();
    });
  }

  if (authCode) {
    authCode.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (authMode !== 'code') return;
      e.preventDefault();
      setStatus('请点击“验证码登录”按钮完成登录', false);
    });
  }

  closeUserMenu();
  setAuthMode('password');
  updatePosterCta();
  init();
})();
