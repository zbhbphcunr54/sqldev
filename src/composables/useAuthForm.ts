import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'
import { useAuthModal } from './useAuthModal'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const AUTH_ERRORS = {
  invalid_credentials: 'auth_invalid_credentials',
  email_not_confirmed: 'auth_email_not_confirmed',
  email_registered: 'auth_email_already_registered',
  password_same: 'auth_password_same',
  password_weak: 'auth_weak_password',
  password_short: 'auth_password_too_short',
  email_invalid: 'auth_email_invalid',
  rate_limit: 'auth_rate_limited',
  otp_invalid: 'auth_otp_invalid',
  network_error: 'auth_network_error'
} as const

export function useAuthForm() {
  const router = useRouter()
  const auth = useAuth()
  const authModal = useAuthModal()
  const { open, view, loginMode, message, redirectTo } = authModal

  const email = ref('')
  const password = ref('')
  const code = ref('')
  const resetPassword = ref('')
  const resetConfirm = ref('')
  const resetCode = ref('')
  const resetCodeSent = ref(false)
  const resetCompleted = ref(false)
  const busy = ref(false)
  const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({
    type: 'idle',
    text: ''
  })
  const showPassword = ref(false)
  const showResetPassword = ref(false)
  const showResetConfirm = ref(false)
  const firstInputRef = ref<HTMLInputElement | null>(null)

  const isResetView = computed(() => view.value === 'reset')
  const modalTitle = computed(() => (isResetView.value ? '重置密码' : '账号登录'))
  const modalDesc = computed(() =>
    isResetView.value
      ? '输入邮箱、新密码和邮箱验证码，完成后请使用新密码重新登录。'
      : '支持密码和验证码两种登录方式，可自行切换。'
  )

  function setStatus(type: 'idle' | 'success' | 'error', text = ''): void {
    status.value = { type, text }
  }

  function localizeAuthError(error: unknown, fallbackCode = 'auth_password_failed'): string {
    const raw = String(error instanceof Error ? error.message : error || '').trim()
    const msg = raw.toLowerCase()
    if (!msg) return mapErrorCodeToMessage(fallbackCode)

    let code = fallbackCode
    if (msg.includes('invalid login credentials')) code = AUTH_ERRORS.invalid_credentials
    else if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed'))
      code = AUTH_ERRORS.email_not_confirmed
    else if (msg.includes('user already registered')) code = AUTH_ERRORS.email_registered
    else if (msg.includes('new password should be different')) code = AUTH_ERRORS.password_same
    else if (msg.includes('password should contain at least one character'))
      code = AUTH_ERRORS.password_weak
    else if (msg.includes('password should be at least') || msg.includes('password is too short'))
      code = AUTH_ERRORS.password_short
    else if (msg.includes('invalid email') || msg.includes('email address'))
      code = AUTH_ERRORS.email_invalid
    else if (
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('over_email_send_rate_limit')
    )
      code = AUTH_ERRORS.rate_limit
    else if (msg.includes('invalid otp') || msg.includes('expired') || msg.includes('token'))
      code = AUTH_ERRORS.otp_invalid
    else if (
      msg.includes('networkerror') ||
      msg.includes('failed to fetch') ||
      msg.includes('fetch failed')
    )
      code = AUTH_ERRORS.network_error

    return mapErrorCodeToMessage(code)
  }

  function resetTransientState(): void {
    password.value = ''
    code.value = ''
    resetPassword.value = ''
    resetConfirm.value = ''
    resetCode.value = ''
    resetCodeSent.value = false
    resetCompleted.value = false
    busy.value = false
    showPassword.value = false
    showResetPassword.value = false
    showResetConfirm.value = false
    setStatus('idle')
  }

  function closeModal(): void {
    authModal.closeModal()
    resetTransientState()
  }

  async function finishLogin(successText = '登录成功'): Promise<void> {
    setStatus('success', successText)
    closeModal()
    await router.push(redirectTo.value || '/workbench/ddl')
  }

  async function loginWithPassword(): Promise<void> {
    if (busy.value) return
    const normalizedEmail = email.value.trim()
    if (!normalizedEmail || !password.value) {
      setStatus('error', mapErrorCodeToMessage('auth_password_required'))
      return
    }
    busy.value = true
    setStatus('idle')
    try {
      await auth.signInWithPassword(normalizedEmail, password.value)
      await finishLogin('登录成功')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_password_failed'))
    } finally {
      busy.value = false
    }
  }

  async function registerWithPassword(): Promise<void> {
    if (busy.value) return
    const normalizedEmail = email.value.trim()
    if (!normalizedEmail || !password.value) {
      setStatus('error', mapErrorCodeToMessage('auth_password_required'))
      return
    }
    busy.value = true
    setStatus('idle')
    try {
      await auth.signUpWithPassword(normalizedEmail, password.value)
      if (auth.isAuthenticated.value) {
        await finishLogin('注册成功')
        return
      }
      setStatus('success', '注册成功。若项目开启邮箱验证，请先在邮件中完成验证后再登录。')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_registration_failed'))
    } finally {
      busy.value = false
    }
  }

  async function sendLoginCode(): Promise<void> {
    if (busy.value) return
    const normalizedEmail = email.value.trim()
    if (!normalizedEmail) {
      setStatus('error', mapErrorCodeToMessage('auth_email_required'))
      return
    }
    busy.value = true
    setStatus('idle')
    try {
      await auth.sendEmailCode(normalizedEmail)
      setStatus('success', '验证码已发送，请输入验证码后点击"验证码登录"。')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_otp_failed'))
    } finally {
      busy.value = false
    }
  }

  async function loginWithCode(): Promise<void> {
    if (busy.value) return
    const normalizedEmail = email.value.trim()
    const token = code.value.trim()
    if (!normalizedEmail || !token) {
      setStatus('error', mapErrorCodeToMessage('auth_code_required'))
      return
    }
    busy.value = true
    setStatus('idle')
    try {
      await auth.verifyEmailCode(normalizedEmail, token)
      await finishLogin('登录成功')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_otp_failed'))
    } finally {
      busy.value = false
    }
  }

  function validateResetForm(): { normalizedEmail: string; nextPassword: string } | null {
    const normalizedEmail = email.value.trim()
    const nextPassword = resetPassword.value.trim()
    const confirmPassword = resetConfirm.value.trim()
    if (!normalizedEmail) {
      setStatus('error', mapErrorCodeToMessage('auth_email_required'))
      return null
    }
    if (!nextPassword) {
      setStatus('error', mapErrorCodeToMessage('auth_password_required'))
      return null
    }
    if (nextPassword.length < 6) {
      setStatus('error', mapErrorCodeToMessage('auth_password_too_short'))
      return null
    }
    if (nextPassword !== confirmPassword) {
      setStatus('error', mapErrorCodeToMessage('auth_password_mismatch'))
      return null
    }
    return { normalizedEmail, nextPassword }
  }

  async function sendResetCode(): Promise<void> {
    if (busy.value) return
    const resetInfo = validateResetForm()
    if (!resetInfo) return
    busy.value = true
    setStatus('idle')
    try {
      await auth.sendEmailCode(resetInfo.normalizedEmail)
      resetCodeSent.value = true
      setStatus('success', '验证码已发送，请查收邮箱后输入验证码。')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_otp_failed'))
    } finally {
      busy.value = false
    }
  }

  async function submitResetPassword(): Promise<void> {
    if (busy.value || resetCompleted.value) return
    const resetInfo = validateResetForm()
    const token = resetCode.value.trim()
    if (!resetInfo) return
    if (!token) {
      setStatus('error', mapErrorCodeToMessage('auth_code_required'))
      return
    }
    busy.value = true
    setStatus('idle')
    try {
      await auth.resetPasswordWithCode(resetInfo.normalizedEmail, token, resetInfo.nextPassword)
      resetCompleted.value = true
      resetCodeSent.value = false
      setStatus('success', '重置密码成功，请点击"重新登录"返回登录弹框。')
    } catch (error) {
      setStatus('error', localizeAuthError(error, 'auth_reset_failed'))
    } finally {
      busy.value = false
    }
  }

  function enterReset(): void {
    authModal.enterReset()
    resetPassword.value = ''
    resetConfirm.value = ''
    resetCode.value = ''
    resetCodeSent.value = false
    resetCompleted.value = false
    setStatus('success', message.value || '请先输入新密码，然后发送验证码。')
  }

  function exitReset(): void {
    authModal.exitReset(resetCompleted.value ? '请使用新密码重新登录。' : '')
    resetCompleted.value = false
    resetCodeSent.value = false
    resetPassword.value = ''
    resetConfirm.value = ''
    resetCode.value = ''
    setStatus(message.value ? 'success' : 'idle', message.value)
  }

  function onMaskClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) closeModal()
  }

  watch(open, async (isOpen) => {
    if (!isOpen) return
    setStatus(message.value ? 'success' : 'idle', message.value)
    await nextTick()
    firstInputRef.value?.focus()
  })

  return {
    open,
    view,
    loginMode,
    redirectTo,
    email,
    password,
    code,
    resetPassword,
    resetConfirm,
    resetCode,
    resetCodeSent,
    resetCompleted,
    busy,
    status,
    showPassword,
    showResetPassword,
    showResetConfirm,
    firstInputRef,
    isResetView,
    modalTitle,
    modalDesc,
    closeModal,
    loginWithPassword,
    registerWithPassword,
    sendLoginCode,
    loginWithCode,
    enterReset,
    exitReset,
    sendResetCode,
    submitResetPassword,
    onMaskClick,
    setLoginMode: authModal.setLoginMode
  }
}
