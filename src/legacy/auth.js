(function () {
  var supabaseGlobal = window.supabase;
  var projectUrl = window.SUPABASE_URL;
  var anonKey = window.SUPABASE_ANON_KEY;

  var authModalMask = document.getElementById('auth-modal-mask');
  var authModal = authModalMask ? authModalMask.querySelector('.auth-modal') : null;
  var authModalHead = authModalMask ? authModalMask.querySelector('.auth-modal-head') : null;
  var authStatus = document.getElementById('auth-status');
  var authPasswordForm = document.getElementById('auth-password-form');
  var authCodeForm = document.getElementById('auth-code-form');
  var authResetForm = document.getElementById('auth-reset-form');
  var authPasswordEmail = document.getElementById('auth-email-password');
  var authCodeEmail = document.getElementById('auth-email-code');
  var authResetEmail = document.getElementById('auth-email-reset');
  var authPassword = document.getElementById('auth-password');
  var authCode = document.getElementById('auth-code');
  var authResetPassword = document.getElementById('auth-reset-password');
  var authResetConfirm = document.getElementById('auth-reset-confirm');
  var authResetCode = document.getElementById('auth-reset-code');
  var authLoginBtn = document.getElementById('auth-login-btn');
  var authRegisterBtn = document.getElementById('auth-register-btn');
  var authCodeLoginBtn = document.getElementById('auth-code-login-btn');
  var authCodeSendBtn = document.getElementById('auth-code-send-btn');
  var authResetBtn = document.getElementById('auth-reset-btn');
  var authResetSendBtn = document.getElementById('auth-reset-send-btn');
  var authCloseBtn = document.getElementById('auth-close-btn');
  var authForgotBtn = document.getElementById('auth-forgot-btn');
  var authResetBackBtn = document.getElementById('auth-reset-back-btn');
  var authModePasswordBtn = document.getElementById('auth-mode-password-btn');
  var authModeCodeBtn = document.getElementById('auth-mode-code-btn');
  var authPasswordToggles = document.querySelectorAll('.auth-password-toggle');
  var authModeSwitch = document.querySelector('.auth-mode-switch');
  var authPasswordActions = document.getElementById('auth-password-actions');
  var authModalTitle = document.getElementById('auth-modal-title');
  var authModalDesc = document.getElementById('auth-modal-desc');

  var appAuthBtn = document.getElementById('app-auth-btn');
  var appUserPop = document.getElementById('app-user-pop');
  var appUserEmail = document.getElementById('app-user-email');

  var user = null;
  var accessToken = '';
  var listeners = [];
  var sb = null;
  var authInitPromise = null;
  var authStateSubscribed = false;
  var authMode = 'password';
  var authView = 'login';
  var passwordRegistering = false;
  var passwordResetting = false;
  var resetCodeSent = false;
  var resetCompleted = false;
  var authModalOffsetX = 0;
  var authModalOffsetY = 0;
  var authModalDragging = false;
  var authModalDragStartX = 0;
  var authModalDragStartY = 0;

  function applyAuthModalPosition() {
    if (!authModal) return;
    authModal.style.transform = 'translate(calc(-50% + ' + authModalOffsetX + 'px), calc(-50% + ' + authModalOffsetY + 'px))';
  }

  function resetAuthModalPosition() {
    authModalOffsetX = 0;
    authModalOffsetY = 0;
    applyAuthModalPosition();
  }

  function clampAuthModalOffset() {
    if (!authModal) return;
    var rect = authModal.getBoundingClientRect();
    var maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - 12);
    var maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - 12);
    if (authModalOffsetX > maxX) authModalOffsetX = maxX;
    if (authModalOffsetX < -maxX) authModalOffsetX = -maxX;
    if (authModalOffsetY > maxY) authModalOffsetY = maxY;
    if (authModalOffsetY < -maxY) authModalOffsetY = -maxY;
  }

  function stopAuthModalDrag() {
    authModalDragging = false;
    document.body.classList.remove('auth-dragging');
  }

  function refreshHeaderRefs() {
    appAuthBtn = document.getElementById('app-auth-btn');
    appUserPop = document.getElementById('app-user-pop');
    appUserEmail = document.getElementById('app-user-email');
    if (appUserPop) appUserPop.removeAttribute('title');
    if (appUserEmail) appUserEmail.removeAttribute('title');
    var avatar = document.getElementById('app-user-avatar');
    if (avatar) avatar.removeAttribute('title');
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

  function refreshSupabaseRuntime() {
    supabaseGlobal = window.supabase;
    projectUrl = window.SUPABASE_URL;
    anonKey = window.SUPABASE_ANON_KEY;
  }

  function hasSupabaseRuntimeConfig() {
    refreshSupabaseRuntime();
    return !!(
      supabaseGlobal &&
      supabaseGlobal.createClient &&
      projectUrl &&
      projectUrl.indexOf('YOUR_PROJECT_ID') < 0 &&
      anonKey &&
      anonKey.indexOf('YOUR_SUPABASE') < 0
    );
  }

  function getAuthNotReadyMessage() {
    refreshSupabaseRuntime();
    if (!supabaseGlobal || !supabaseGlobal.createClient) return 'Supabase SDK 未加载，请刷新页面后重试';
    if (window.SUPABASE_CONFIG_SOURCE === 'missing' || !projectUrl || !anonKey) {
      return '认证配置未注入，请使用 pnpm dev 或 pnpm build && pnpm preview 访问页面';
    }
    return '认证未初始化，请检查 Supabase 配置';
  }

  async function ensureAuthClient() {
    if (sb) return true;
    if (!hasSupabaseRuntimeConfig()) {
      setStatus(getAuthNotReadyMessage(), true);
      updatePosterCta();
      return false;
    }
    try {
      sb = supabaseGlobal.createClient(projectUrl, anonKey);
      await syncSession();
      bindAuthStateChange();
    } catch (_err) {
      sb = null;
      setStatus(getAuthNotReadyMessage(), true);
      updatePosterCta();
      return false;
    }
    return !!sb;
  }

  function bindAuthStateChange() {
    if (!sb || !sb.auth || authStateSubscribed) return;
    authStateSubscribed = true;
    sb.auth.onAuthStateChange(function (_event, session) {
      var sessionToken = normalizeToken(session && session.access_token ? session.access_token : '');
      accessToken = (sessionToken && !isJwtExpired(sessionToken)) ? sessionToken : '';
      user = accessToken && session && session.user ? session.user : null;
      updatePosterCta();
      emit();

      var authEvent = String(_event || '').toUpperCase();
      var shouldNotifyLoginSuccess = authEvent === 'SIGNED_IN';
      if (user && !passwordRegistering && !passwordResetting && shouldNotifyLoginSuccess) {
        if (authCode) authCode.value = '';
        closeAuthModal();
        window.dispatchEvent(new CustomEvent('auth:login-success', { detail: { user: user } }));
      }
    });
  }

  function getAuthEmailInputs() {
    return [authPasswordEmail, authCodeEmail, authResetEmail];
  }

  function setAuthEmailValue(value, sourceInput) {
    var next = String(value || '').trim();
    var inputs = getAuthEmailInputs();
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (!input || input === sourceInput) continue;
      input.value = next;
    }
  }

  function getActiveAuthEmailInput() {
    if (authView === 'reset') return authResetEmail;
    return authMode === 'code' ? authCodeEmail : authPasswordEmail;
  }

  function getAuthEmailValue() {
    var active = getActiveAuthEmailInput();
    var value = (active && active.value || '').trim();
    if (value) return value;
    var inputs = getAuthEmailInputs();
    for (var i = 0; i < inputs.length; i++) {
      var fallback = (inputs[i] && inputs[i].value || '').trim();
      if (fallback) return fallback;
    }
    return '';
  }

  function normalizeToken(token) {
    return (token || '').replace(/\s+/g, '').trim();
  }

  function isJwtToken(token) {
    return /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(normalizeToken(token));
  }

  function isJwtExpired(token) {
    var t = normalizeToken(token);
    if (!isJwtToken(t)) return true;
    try {
      var parts = t.split('.');
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      var json = JSON.parse(atob(payload));
      var exp = Number(json && json.exp);
      if (!Number.isFinite(exp) || exp <= 0) return true;
      return (Date.now() + 5000) >= exp * 1000;
    } catch (_e) {
      return true;
    }
  }

  function getEmail() {
    if (!user) return '';
    return (user.email || '').trim();
  }

  function isEmailNotConfirmedError(err) {
    var msg = String((err && err.message) || err || '').toLowerCase();
    return msg.indexOf('email not confirmed') >= 0 ||
      msg.indexOf('email_not_confirmed') >= 0 ||
      msg.indexOf('not confirmed') >= 0;
  }

  function localizeAuthError(err, fallback) {
    var raw = String((err && err.message) || err || '').trim();
    var msg = raw.toLowerCase();
    if (!msg) return fallback;
    if (msg.indexOf('invalid login credentials') >= 0) return '邮箱或密码错误';
    if (msg.indexOf('email not confirmed') >= 0 || msg.indexOf('email_not_confirmed') >= 0) return '邮箱未验证，请先完成邮箱验证';
    if (msg.indexOf('user already registered') >= 0) return '该邮箱已注册，请直接登录';
    if (msg.indexOf('new password should be different from the old password') >= 0) return '新密码不能与旧密码相同，请换一个新密码';
    if (msg.indexOf('password should contain at least one character of each') >= 0) return '密码需同时包含大写字母、小写字母、数字和特殊字符';
    if (msg.indexOf('password should be at least') >= 0 || msg.indexOf('password is too short') >= 0) return '密码至少 6 位';
    if (msg.indexOf('invalid email') >= 0 || msg.indexOf('email address') >= 0) return '邮箱格式不正确';
    if (msg.indexOf('rate limit') >= 0 || msg.indexOf('too many requests') >= 0 || msg.indexOf('over_email_send_rate_limit') >= 0) return '操作过于频繁，请稍后再试';
    if (msg.indexOf('invalid otp') >= 0 || msg.indexOf('otp') >= 0 || msg.indexOf('token has expired') >= 0 || msg.indexOf('expired') >= 0 || msg.indexOf('token') >= 0) return '验证码无效或已过期，请重新获取';
    if (msg.indexOf('networkerror') >= 0 || msg.indexOf('failed to fetch') >= 0 || msg.indexOf('fetch failed') >= 0) return '网络异常，请检查网络后重试';
    return fallback;
  }

  async function resendSignupConfirmation(email) {
    if (!sb || !email || !sb.auth || typeof sb.auth.resend !== 'function') return false;
    try {
      var redirectTo = window.location.origin + window.location.pathname;
      var resendRes = await sb.auth.resend({
        type: 'signup',
        email: email,
        options: { emailRedirectTo: redirectTo }
      });
      return !(resendRes && resendRes.error);
    } catch (_e) {
      return false;
    }
  }

  function setBusy(busy) {
    if (authLoginBtn) authLoginBtn.disabled = busy;
    if (authRegisterBtn) authRegisterBtn.disabled = busy;
    if (authCodeLoginBtn) authCodeLoginBtn.disabled = busy;
    if (authCodeSendBtn) authCodeSendBtn.disabled = busy;
    if (authResetBtn) authResetBtn.disabled = busy;
    if (authResetSendBtn) authResetSendBtn.disabled = busy;
    if (authPasswordEmail) authPasswordEmail.disabled = busy;
    if (authCodeEmail) authCodeEmail.disabled = busy;
    if (authResetEmail) authResetEmail.disabled = busy;
    if (authPassword) authPassword.disabled = busy;
    if (authCode) authCode.disabled = busy;
    if (authResetPassword) authResetPassword.disabled = busy;
    if (authResetConfirm) authResetConfirm.disabled = busy;
    if (authResetCode) authResetCode.disabled = busy;
    if (authModePasswordBtn) authModePasswordBtn.disabled = busy;
    if (authModeCodeBtn) authModeCodeBtn.disabled = busy;
    if (authForgotBtn) authForgotBtn.disabled = busy;
    if (authResetBackBtn) authResetBackBtn.disabled = busy;
  }

  function renderAuthForm() {
    var resetMode = authView === 'reset';
    var passwordMode = authMode === 'password';

    if (authModeSwitch) {
      authModeSwitch.hidden = resetMode;
      authModeSwitch.style.display = resetMode ? 'none' : 'grid';
    }
    if (authResetEmail) authResetEmail.readOnly = resetMode;
    if (authPasswordEmail) authPasswordEmail.readOnly = false;
    if (authCodeEmail) authCodeEmail.readOnly = false;

    if (authModePasswordBtn) {
      authModePasswordBtn.classList.toggle('active', passwordMode);
      authModePasswordBtn.setAttribute('aria-selected', passwordMode ? 'true' : 'false');
    }
    if (authModeCodeBtn) {
      authModeCodeBtn.classList.toggle('active', !passwordMode);
      authModeCodeBtn.setAttribute('aria-selected', passwordMode ? 'false' : 'true');
    }

    if (authPasswordForm) authPasswordForm.hidden = resetMode || !passwordMode;
    if (authCodeForm) authCodeForm.hidden = resetMode || passwordMode;
    if (authResetForm) authResetForm.hidden = !resetMode;
    if (authPasswordActions) authPasswordActions.hidden = resetMode || !passwordMode;

    if (authRegisterBtn) {
      authRegisterBtn.hidden = resetMode || !passwordMode;
      authRegisterBtn.textContent = '密码注册';
    }
    if (authLoginBtn) {
      authLoginBtn.hidden = resetMode || !passwordMode;
      authLoginBtn.textContent = '密码登录';
    }
    if (authCodeSendBtn) {
      authCodeSendBtn.hidden = resetMode || passwordMode;
      authCodeSendBtn.textContent = '发送验证码';
    }
    if (authCodeLoginBtn) {
      authCodeLoginBtn.hidden = resetMode || passwordMode;
      authCodeLoginBtn.textContent = '验证码登录';
    }
    if (authResetBtn) {
      authResetBtn.hidden = !resetMode || resetCompleted;
      authResetBtn.textContent = '确定重置';
    }
    if (authResetSendBtn) {
      authResetSendBtn.hidden = !resetMode || resetCompleted;
      authResetSendBtn.textContent = resetCodeSent ? '重新发送验证码' : '发送验证码';
    }
    if (authResetBackBtn) authResetBackBtn.textContent = resetCompleted ? '重新登录' : '返回登录';
    if (authModalTitle) authModalTitle.textContent = resetMode ? '重置密码' : '账号登录';
    if (authModalDesc) {
      authModalDesc.textContent = resetMode
        ? '账号会自动带入，请先填写新密码并发送邮箱验证码，收到验证码后再确认重置。'
        : '支持密码和验证码两种登录方式，可自行切换。';
    }
    if (authResetPassword) authResetPassword.readOnly = resetCompleted;
    if (authResetConfirm) authResetConfirm.readOnly = resetCompleted;
    if (authResetCode) authResetCode.readOnly = resetCompleted;
  }

  function setAuthMode(mode) {
    authMode = mode === 'code' ? 'code' : 'password';
    authView = 'login';
    setAuthEmailValue(getAuthEmailValue());
    resetCodeSent = false;
    resetCompleted = false;
    if (authResetPassword) authResetPassword.value = '';
    if (authResetConfirm) authResetConfirm.value = '';
    if (authResetCode) authResetCode.value = '';
    renderAuthForm();
    setStatus('', false);
  }

  function enterResetPasswordMode(message) {
    authView = 'reset';
    setAuthEmailValue(getAuthEmailValue());
    resetCodeSent = false;
    resetCompleted = false;
    if (authResetPassword) authResetPassword.value = '';
    if (authResetConfirm) authResetConfirm.value = '';
    if (authResetCode) authResetCode.value = '';
    renderAuthForm();
    setStatus(message || '请输入新密码，然后发送验证码。', false);
  }

  function exitResetPasswordMode(message) {
    authView = 'login';
    authMode = 'password';
    setAuthEmailValue(getAuthEmailValue());
    resetCodeSent = false;
    resetCompleted = false;
    if (authResetPassword) authResetPassword.value = '';
    if (authResetConfirm) authResetConfirm.value = '';
    if (authResetCode) authResetCode.value = '';
    renderAuthForm();
    setStatus(message || '', false);
  }

  function updatePosterCta() {
    refreshHeaderRefs();
    var loggedIn = !!user;
    if (appUserPop) appUserPop.hidden = !loggedIn;
    var sidebarLogout = document.getElementById('sidebar-logout-btn');
    var sidebarLogoutArea = document.getElementById('sidebar-logout-area');
    if (sidebarLogout) sidebarLogout.hidden = !loggedIn;
    if (sidebarLogoutArea) sidebarLogoutArea.hidden = !loggedIn;
    if (appAuthBtn) {
      var svgEl = appAuthBtn.querySelector('svg');
      if (svgEl) {
        while (appAuthBtn.lastChild && appAuthBtn.lastChild !== svgEl) appAuthBtn.removeChild(appAuthBtn.lastChild);
        appAuthBtn.appendChild(document.createTextNode(' 退出登录'));
      } else {
        appAuthBtn.textContent = '退出登录';
      }
    }
    if (appUserEmail) appUserEmail.textContent = getEmail();
  }

  function closeUserMenu() {
    return;
  }

  function toggleUserMenu() {
    return;
  }

  function openAuthModal(message) {
    if (!authModalMask) return;
    authModalMask.hidden = false;
    resetAuthModalPosition();
    setAuthEmailValue(getAuthEmailValue());
    setStatus(message || '', false);
    renderAuthForm();
    var activeEmailInput = getActiveAuthEmailInput();
    if (authView === 'reset' && authResetPassword) {
      authResetPassword.focus();
      return;
    }
    if (activeEmailInput && !activeEmailInput.value) {
      activeEmailInput.focus();
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
    stopAuthModalDrag();
    authModalMask.hidden = true;
    setStatus('', false);
    authView = 'login';
    authMode = 'password';
  }

  function returnToSplashHome() {
    closeUserMenu();
    closeAuthModal();
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'sqldev:navigate-home' }, window.location.origin);
        return;
      } catch (_postMessageErr) {}
    }
    window.location.href = './';
  }

  async function syncSession() {
    if (!sb) return;
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    var sessionToken = normalizeToken(session && session.access_token ? session.access_token : '');
    accessToken = (sessionToken && !isJwtExpired(sessionToken)) ? sessionToken : '';
    user = accessToken && session && session.user ? session.user : null;
    updatePosterCta();
    emit();
  }

  async function sendEmailCode(email) {
    var redirectTo = window.location.origin + window.location.pathname;
    var firstTry = await sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo
      }
    });
    if (!firstTry || !firstTry.error) return firstTry;
    var msg = String(firstTry.error.message || '').toLowerCase();
    if (msg.indexOf('user not found') >= 0 || msg.indexOf('no user') >= 0 || msg.indexOf('not registered') >= 0) {
      return sb.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo
        }
      });
    }
    return firstTry;
  }

  async function verifyEmailCode(email, token) {
    var tryTypes = ['email', 'magiclink', 'signup'];
    var lastError = null;
    for (var i = 0; i < tryTypes.length; i++) {
      var res = await sb.auth.verifyOtp({
        email: email,
        token: token,
        type: tryTypes[i]
      });
      if (res && !res.error) return res;
      lastError = res ? res.error : null;
    }
    return { data: null, error: lastError || new Error('验证码无效或已过期') };
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

  function validateResetForm() {
    var email = getAuthEmailValue();
    var nextPassword = (authResetPassword && authResetPassword.value || '').trim();
    var confirmPassword = (authResetConfirm && authResetConfirm.value || '').trim();
    if (!email) throw new Error('请先输入邮箱');
    if (!nextPassword) throw new Error('请输入新密码');
    if (nextPassword.length < 6) throw new Error('密码至少 6 位');
    if (nextPassword !== confirmPassword) throw new Error('两次输入的新密码不一致');
    return {
      email: email,
      nextPassword: nextPassword
    };
  }

  async function submitPasswordResetRequest() {
    await ensureAuthClient();
    if (!sb) return;
    var email = getAuthEmailValue();
    if (!email) return setStatus('请先输入邮箱，再进入密码重置', true);
    enterResetPasswordMode('请先输入新密码，然后发送验证码。');
  }

  async function sendResetPasswordCode() {
    await ensureAuthClient();
    if (!sb) return;
    try {
      var resetInfo = validateResetForm();
      setBusy(true);
      setStatus('正在发送验证码...');
      var res = await sendEmailCode(resetInfo.email);
      if (res.error) throw res.error;
      resetCodeSent = true;
      renderAuthForm();
      setStatus('验证码已发送，请查收邮箱后输入验证码。', false);
      if (authResetCode) authResetCode.focus();
    } catch (err) {
      setStatus(localizeAuthError(err, '发送验证码失败'), true);
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    await ensureAuthClient();
    if (!sb) return;
    try {
      var resetInfo = validateResetForm();
      var token = normalizeToken(authResetCode && authResetCode.value);
      if (!token) throw new Error('请输入验证码');
      setBusy(true);
      passwordResetting = true;
      setStatus('正在校验验证码并重置密码...');
      var verifyRes = await verifyEmailCode(resetInfo.email, token);
      if (verifyRes.error) throw verifyRes.error;
      var verifiedSession = verifyRes && verifyRes.data ? verifyRes.data.session : null;
      if (verifiedSession && verifiedSession.access_token && verifiedSession.refresh_token &&
          sb.auth && typeof sb.auth.setSession === 'function') {
        var setSessionRes = await sb.auth.setSession({
          access_token: verifiedSession.access_token,
          refresh_token: verifiedSession.refresh_token
        });
        if (setSessionRes && setSessionRes.error) throw setSessionRes.error;
      }
      var currentSessionRes = await sb.auth.getSession();
      var currentSession = currentSessionRes && currentSessionRes.data ? currentSessionRes.data.session : null;
      if (!currentSession || !currentSession.access_token) {
        throw new Error('验证码校验成功，但登录会话建立失败，请重新获取验证码后重试');
      }
      var updateRes = await sb.auth.updateUser({ password: resetInfo.nextPassword });
      if (updateRes.error) throw updateRes.error;
      try {
        await sb.auth.signOut();
      } catch (_e) {}
      user = null;
      accessToken = '';
      resetCompleted = true;
      resetCodeSent = false;
      renderAuthForm();
      updatePosterCta();
      emit();
      setStatus('重置密码成功，请点击“重新登录”返回登录弹框。', false);
    } catch (err) {
      var fallback = '重置密码失败';
      var raw = String((err && err.message) || err || '').trim();
      if (raw && localizeAuthError(err, fallback) === fallback) {
        fallback = '重置密码失败：' + raw;
      }
      setStatus(localizeAuthError(err, fallback), true);
    } finally {
      passwordResetting = false;
      setBusy(false);
    }
  }

  async function signOut() {
    if (!sb) {
      user = null;
      accessToken = '';
      if (authCode) authCode.value = '';
      closeAuthModal();
      updatePosterCta();
      emit();
      return { error: null };
    }
    var res = { error: null };
    user = null;
    accessToken = '';
    if (authView === 'reset') exitResetPasswordMode('');
    if (authCode) authCode.value = '';
    closeAuthModal();
    updatePosterCta();
    emit();
    try {
      var signOutPromise = sb.auth.signOut();
      var timeoutPromise = new Promise(function(resolve) {
        setTimeout(function() { resolve({ error: null, timeout: true }); }, 1500);
      });
      res = await Promise.race([signOutPromise, timeoutPromise]);
    } catch (err) {
      res = { error: err };
    }
    return res;
  }

  function getUserSync() {
    return user;
  }

  function getAccessToken() {
    return accessToken;
  }

  async function ensureAccessToken(forceRefresh) {
    if (!sb || !sb.auth) return accessToken || '';
    if (!forceRefresh && accessToken && !isJwtExpired(accessToken)) {
      return accessToken;
    }
    var needsRefresh = forceRefresh || !accessToken || isJwtExpired(accessToken);
    if (needsRefresh && typeof sb.auth.refreshSession === 'function') {
      try {
        var refreshRes = await sb.auth.refreshSession();
        var refreshSession = refreshRes && refreshRes.data ? refreshRes.data.session : null;
        var refreshedToken = normalizeToken(refreshSession && refreshSession.access_token ? refreshSession.access_token : '');
        if (refreshedToken && !isJwtExpired(refreshedToken)) {
          accessToken = refreshedToken;
          user = refreshSession && refreshSession.user ? refreshSession.user : null;
          updatePosterCta();
          emit();
          return accessToken;
        }
      } catch (_refreshErr) {}
    }
    try {
      var sessionRes = await sb.auth.getSession();
      var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
      var sessionToken = normalizeToken(session && session.access_token ? session.access_token : '');
      accessToken = (sessionToken && !isJwtExpired(sessionToken)) ? sessionToken : '';
      user = accessToken && session && session.user ? session.user : null;
      updatePosterCta();
      emit();
      return accessToken;
    } catch (_e) {
      accessToken = '';
      user = null;
      updatePosterCta();
      emit();
      return '';
    }
  }

  function onUserChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  async function init() {
    refreshSupabaseRuntime();
    if (!supabaseGlobal || !supabaseGlobal.createClient) {
      setStatus('Supabase SDK 未加载', true);
      return;
    }
    if (!projectUrl || projectUrl.indexOf('YOUR_PROJECT_ID') >= 0 || !anonKey || anonKey.indexOf('YOUR_SUPABASE') >= 0) {
      setStatus('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY', true);
      updatePosterCta();
      return;
    }

    sb = supabaseGlobal.createClient(projectUrl, anonKey);
    await syncSession();

    sb.auth.onAuthStateChange(function (_event, session) {
      var sessionToken = normalizeToken(session && session.access_token ? session.access_token : '');
      accessToken = (sessionToken && !isJwtExpired(sessionToken)) ? sessionToken : '';
      user = accessToken && session && session.user ? session.user : null;
      updatePosterCta();
      emit();

      var authEvent = String(_event || '').toUpperCase();
      // IMPORTANT: INITIAL_SESSION happens on page load/session restore.
      // We only treat explicit sign-in as "login success" to avoid
      // splash page refresh being forced back to workbench.
      var shouldNotifyLoginSuccess = authEvent === 'SIGNED_IN';
      if (user && !passwordRegistering && !passwordResetting && shouldNotifyLoginSuccess) {
        if (authCode) authCode.value = '';
        closeAuthModal();
        window.dispatchEvent(new CustomEvent('auth:login-success', { detail: { user: user } }));
      }
    });
  }

  async function submitRegister() {
    await ensureAuthClient();
    if (!sb) return;
    var email = getAuthEmailValue();
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
        if (registerRes && registerRes.data && registerRes.data.session) {
          await sb.auth.signOut();
          user = null;
          accessToken = '';
          updatePosterCta();
          emit();
        }
        if (authPassword) authPassword.value = '';
        var needsConfirm = !(registerRes && registerRes.data && registerRes.data.session);
        if (needsConfirm) {
          setStatus('注册成功。当前项目已开启邮箱验证，请先在邮件中完成验证后再密码登录。', false);
        } else {
          setStatus('注册成功，请重新输入密码后点击“密码登录”进入。', false);
        }
        if (authPassword) authPassword.focus();
      } catch (err1) {
        setStatus(localizeAuthError(err1, '注册失败'), true);
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
      setStatus('验证码已发送，请输入验证码后点击“验证码登录”。', false);
      if (authCode) authCode.focus();
    } catch (err2) {
      setStatus(localizeAuthError(err2, '发送验证码失败'), true);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin() {
    await ensureAuthClient();
    if (!sb) return;
    var email = getAuthEmailValue();
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
      if (authMode === 'password' && isEmailNotConfirmedError(err)) {
        var resent = await resendSignupConfirmation(email);
        var hint = '邮箱未验证，请先完成邮箱验证后再密码登录。';
        if (resent) hint += ' 已为你重新发送验证邮件。';
        setStatus(hint, true);
      } else {
        setStatus(localizeAuthError(err, '登录失败'), true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function invokeFunction(name, body) {
    await ensureAuthClient();
    if (!sb) throw new Error(getAuthNotReadyMessage());
    var token = await ensureAccessToken(false);
    if (!token || isJwtExpired(token)) token = await ensureAccessToken(true);
    if (!token || isJwtExpired(token)) {
      user = null;
      accessToken = '';
      closeUserMenu();
      updatePosterCta();
      emit();
      throw new Error('登录状态已失效，请点击右上角退出后重新登录');
    }
    var requestBody = Object.assign({}, body || {});
    var fnClient = sb.functions;
    if (!fnClient || typeof fnClient.invoke !== 'function') {
      throw new Error('Supabase Functions 客户端不可用');
    }
    if (typeof fnClient.setAuth === 'function') {
      fnClient.setAuth(token);
    }
    var invokeRes = await fnClient.invoke(name, {
      body: requestBody,
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    return {
      data: invokeRes && Object.prototype.hasOwnProperty.call(invokeRes, 'data') ? invokeRes.data : null,
      error: invokeRes && Object.prototype.hasOwnProperty.call(invokeRes, 'error') ? invokeRes.error : null
    };
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
    ensureAccessToken: ensureAccessToken,
    invokeFunction: invokeFunction,
    onUserChange: onUserChange,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal
  };

  if (authModalMask) {
    authModalMask.addEventListener('click', function (e) {
      if (e.target === authModalMask) closeAuthModal();
    });
  }
  if (authModalHead) {
    authModalHead.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('#auth-close-btn')) return;
      if (e.button !== 0) return;
      authModalDragging = true;
      authModalDragStartX = e.clientX - authModalOffsetX;
      authModalDragStartY = e.clientY - authModalOffsetY;
      document.body.classList.add('auth-dragging');
    });
  }
  document.addEventListener('pointermove', function (e) {
    if (!authModalDragging) return;
    authModalOffsetX = e.clientX - authModalDragStartX;
    authModalOffsetY = e.clientY - authModalDragStartY;
    clampAuthModalOffset();
    applyAuthModalPosition();
  });
  document.addEventListener('pointerup', function () {
    if (!authModalDragging) return;
    stopAuthModalDrag();
  });
  window.addEventListener('resize', function () {
    clampAuthModalOffset();
    applyAuthModalPosition();
  });
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (authForgotBtn) {
    authForgotBtn.addEventListener('click', function () {
      submitPasswordResetRequest();
    });
  }
  if (authResetSendBtn) authResetSendBtn.addEventListener('click', sendResetPasswordCode);
  if (authResetBackBtn) {
    authResetBackBtn.addEventListener('click', function () {
      exitResetPasswordMode(resetCompleted ? '请使用新密码重新登录。' : '');
      if (authPassword) authPassword.focus();
    });
  }

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

  document.addEventListener('click', async function (e) {
    refreshHeaderRefs();
    var logoutBtn = e.target && e.target.closest ? (e.target.closest('#app-auth-btn') || e.target.closest('#sidebar-logout-btn')) : null;
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (user) signOut();
      returnToSplashHome();
    }
  });

  if (authRegisterBtn) {
    authRegisterBtn.addEventListener('click', function () {
      authMode = 'password';
      submitRegister();
    });
  }
  if (authCodeSendBtn) {
    authCodeSendBtn.addEventListener('click', function () {
      authMode = 'code';
      submitRegister();
    });
  }

  if (authPasswordForm) {
    authPasswordForm.addEventListener('submit', function (e) {
      e.preventDefault();
      authMode = 'password';
      submitLogin();
    });
  }
  if (authCodeForm) {
    authCodeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      authMode = 'code';
      submitLogin();
    });
  }
  if (authResetForm) {
    authResetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitResetPassword();
    });
  }

  var emailInputs = getAuthEmailInputs();
  for (var emailIndex = 0; emailIndex < emailInputs.length; emailIndex++) {
    (function (emailInput) {
      if (!emailInput) return;
      emailInput.addEventListener('input', function () {
        setAuthEmailValue(emailInput.value, emailInput);
      });
      emailInput.addEventListener('change', function () {
        setAuthEmailValue(emailInput.value, emailInput);
      });
    })(emailInputs[emailIndex]);
  }

  if (authResetConfirm) {
    authResetConfirm.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || authView !== 'reset') return;
      e.preventDefault();
      if (!resetCodeSent) {
        sendResetPasswordCode();
        return;
      }
      if (authResetCode) authResetCode.focus();
    });
  }

  if (authResetCode) {
    authResetCode.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || authView !== 'reset' || resetCompleted) return;
      e.preventDefault();
      submitResetPassword();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!authModalMask || authModalMask.hidden) return;
    closeAuthModal();
  });

  if (authPasswordToggles && authPasswordToggles.length) {
    for (var i = 0; i < authPasswordToggles.length; i++) {
      authPasswordToggles[i].addEventListener('click', function () {
        var targetId = this.getAttribute('data-target');
        if (!targetId) return;
        var input = document.getElementById(targetId);
        if (!input) return;
        var nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        this.classList.toggle('active', nextType === 'text');
      });
    }
  }

  closeUserMenu();
  setAuthMode('password');
  updatePosterCta();
  init();
})();
