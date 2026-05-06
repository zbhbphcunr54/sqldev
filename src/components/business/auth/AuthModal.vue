<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const router = useRouter()
const auth = useAuth()
const authModal = useAuthModal()
const { open, view, loginMode, message, redirectTo } = authModal

// [2026-05-03] 新增：统一的错误代码映射
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

const email = ref('')
const password = ref('')
const code = ref('')
const resetPassword = ref('')
const resetConfirm = ref('')
const resetCode = ref('')
const resetCodeSent = ref(false)
const resetCompleted = ref(false)
const busy = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })
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

// [2026-05-03] 修改：使用统一的错误代码映射
function localizeAuthError(error: unknown, fallbackCode = 'auth_password_failed'): string {
  const raw = String(error instanceof Error ? error.message : error || '').trim()
  const msg = raw.toLowerCase()

  let code = fallbackCode
  if (!msg) return mapErrorCodeToMessage(code)

  if (msg.includes('invalid login credentials')) code = AUTH_ERRORS.invalid_credentials
  else if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) code = AUTH_ERRORS.email_not_confirmed
  else if (msg.includes('user already registered')) code = AUTH_ERRORS.email_registered
  else if (msg.includes('new password should be different')) code = AUTH_ERRORS.password_same
  else if (msg.includes('password should contain at least one character')) code = AUTH_ERRORS.password_weak
  else if (msg.includes('password should be at least') || msg.includes('password is too short')) code = AUTH_ERRORS.password_short
  else if (msg.includes('invalid email') || msg.includes('email address')) code = AUTH_ERRORS.email_invalid
  else if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) code = AUTH_ERRORS.rate_limit
  else if (msg.includes('invalid otp') || msg.includes('expired') || msg.includes('token')) code = AUTH_ERRORS.otp_invalid
  else if (msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('fetch failed')) code = AUTH_ERRORS.network_error

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
    await finishLogin(mapErrorCodeToMessage('auth_login_success') || '登录成功')
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
    setStatus('success', '验证码已发送，请输入验证码后点击”验证码登录”。')
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

function enterReset(): void {
  authModal.enterReset()
  resetPassword.value = ''
  resetConfirm.value = ''
  resetCode.value = ''
  resetCodeSent.value = false
  resetCompleted.value = false
  setStatus('success', message.value || '请先输入新密码，然后发送验证码。')
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
    setStatus('success', '重置密码成功，请点击”重新登录”返回登录弹框。')
  } catch (error) {
    setStatus('error', localizeAuthError(error, 'auth_reset_failed'))
  } finally {
    busy.value = false
  }
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
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="auth-modal-mask" @click="onMaskClick" @keydown.esc="closeModal">
      <div
        class="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
      >
        <div class="auth-modal-head">
          <h3 id="auth-modal-title">{{ modalTitle }}</h3>
          <button class="auth-close" type="button" aria-label="关闭" @click="closeModal">
            &times;
          </button>
        </div>
        <p id="auth-modal-desc" class="auth-modal-desc">{{ modalDesc }}</p>

        <div v-if="!isResetView" class="auth-mode-switch" role="tablist" aria-label="登录方式">
          <button
            class="auth-mode-btn"
            :class="{ active: loginMode === 'password' }"
            type="button"
            role="tab"
            :aria-selected="loginMode === 'password'"
            @click="authModal.setLoginMode('password')"
          >
            密码登录
          </button>
          <button
            class="auth-mode-btn"
            :class="{ active: loginMode === 'code' }"
            type="button"
            role="tab"
            :aria-selected="loginMode === 'code'"
            @click="authModal.setLoginMode('code')"
          >
            验证码登录
          </button>
        </div>

        <form
          v-if="!isResetView && loginMode === 'password'"
          class="auth-form"
          autocomplete="on"
          @submit.prevent="loginWithPassword"
        >
          <label class="auth-label" for="auth-email-password">邮箱</label>
          <input
            id="auth-email-password"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            required
          />
          <label class="auth-label" for="auth-password">密码</label>
          <div class="auth-password-field">
            <input
              id="auth-password"
              v-model="password"
              class="auth-input auth-input-password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="至少 6 位"
              required
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showPassword }"
              type="button"
              aria-label="显示或隐藏密码"
              @click="showPassword = !showPassword"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <div class="auth-inline-actions">
            <button class="auth-text-btn" type="button" @click="enterReset">忘记密码？</button>
          </div>
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions">
            <button class="auth-btn" type="button" :disabled="busy" @click="registerWithPassword">
              密码注册
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy">
              {{ busy ? '登录中...' : '密码登录' }}
            </button>
          </div>
        </form>

        <form
          v-else-if="!isResetView"
          class="auth-form"
          autocomplete="on"
          @submit.prevent="loginWithCode"
        >
          <label class="auth-label" for="auth-email-code">邮箱</label>
          <input
            id="auth-email-code"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            required
          />
          <label class="auth-label" for="auth-code">验证码</label>
          <input
            id="auth-code"
            v-model="code"
            class="auth-input"
            name="otp"
            type="text"
            autocomplete="one-time-code"
            inputmode="numeric"
            placeholder="请输入邮箱收到的验证码"
            required
          />
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions">
            <button class="auth-btn" type="button" :disabled="busy" @click="sendLoginCode">
              {{ busy ? '发送中...' : '发送验证码' }}
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy">
              {{ busy ? '登录中...' : '验证码登录' }}
            </button>
          </div>
        </form>

        <form v-else class="auth-form" autocomplete="on" @submit.prevent="submitResetPassword">
          <label class="auth-label" for="auth-email-reset">邮箱</label>
          <input
            id="auth-email-reset"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            :readonly="resetCompleted"
            required
          />
          <label class="auth-label" for="auth-reset-password">新密码</label>
          <div class="auth-password-field">
            <input
              id="auth-reset-password"
              v-model="resetPassword"
              class="auth-input auth-input-password"
              name="new-password"
              :type="showResetPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请输入新密码"
              required
              :readonly="resetCompleted"
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showResetPassword }"
              type="button"
              aria-label="显示或隐藏新密码"
              @click="showResetPassword = !showResetPassword"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <label class="auth-label" for="auth-reset-confirm">确认新密码</label>
          <div class="auth-password-field">
            <input
              id="auth-reset-confirm"
              v-model="resetConfirm"
              class="auth-input auth-input-password"
              name="confirm-password"
              :type="showResetConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请再次输入新密码"
              required
              :readonly="resetCompleted"
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showResetConfirm }"
              type="button"
              aria-label="显示或隐藏确认密码"
              @click="showResetConfirm = !showResetConfirm"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <p class="auth-input-hint">密码需同时包含大写字母、小写字母、数字和特殊字符</p>
          <label class="auth-label" for="auth-reset-code">验证码</label>
          <input
            id="auth-reset-code"
            v-model="resetCode"
            class="auth-input"
            name="otp"
            type="text"
            autocomplete="one-time-code"
            inputmode="numeric"
            placeholder="请输入邮箱收到的验证码"
            required
            :readonly="resetCompleted"
          />
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions auth-reset-actions">
            <button
              class="auth-btn"
              type="button"
              :disabled="busy || resetCompleted"
              @click="sendResetCode"
            >
              {{ resetCodeSent ? '重新发送验证码' : '发送验证码' }}
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy || resetCompleted">
              {{ busy ? '重置中...' : '确定重置' }}
            </button>
          </div>
          <div class="auth-inline-actions auth-reset-footer">
            <button class="auth-text-btn" type="button" @click="exitReset">
              {{ resetCompleted ? '重新登录' : '返回登录' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
}

.auth-modal {
  width: 420px;
  max-width: 96vw;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}

.auth-modal-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 28px 0;
  text-align: center;
}

.auth-modal-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4f7df9, #8b5cf6);
  display: grid;
  place-items: center;
  font-family: var(--font-code);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 10px;
}

.auth-modal-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.auth-modal-desc {
  margin: 3px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.auth-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.auth-close:hover {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.auth-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--color-border);
  margin-top: 20px;
}

.auth-mode-btn {
  padding: 13px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-mode-btn:hover {
  color: var(--color-text);
}

.auth-mode-btn.active {
  color: var(--color-brand-500);
  border-bottom-color: var(--color-brand-500);
}

.auth-form {
  padding: 20px 28px 24px;
}

.auth-label {
  display: block;
  margin-bottom: 5px;
  color: var(--color-text-subtle);
  font-size: 12px;
  font-weight: 500;
}

.auth-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.auth-input-password {
  padding-right: 38px;
}

.auth-input::placeholder {
  color: var(--color-text-muted);
}

.auth-input:focus {
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.auth-input[type='password']::-ms-reveal,
.auth-input[type='password']::-ms-clear {
  display: none;
}

.auth-password-field {
  position: relative;
}

.auth-password-toggle {
  position: absolute;
  top: 50%;
  right: 10px;
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transform: translateY(-50%);
}

.auth-password-toggle:hover {
  color: var(--color-text);
}

.auth-password-toggle svg {
  width: 16px;
  height: 16px;
}

.auth-password-toggle-slash {
  position: absolute;
  width: 14px;
  height: 1.5px;
  background: currentColor;
  transform: rotate(-35deg) scaleX(0);
  transition: transform 0.15s ease;
}

.auth-password-toggle.active .auth-password-toggle-slash {
  transform: rotate(-35deg) scaleX(1);
}

.auth-input-hint,
.auth-status {
  font-size: 12px;
}

.auth-input-hint {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.auth-status {
  min-height: 18px;
  margin: 8px 0 0;
  color: var(--color-success);
}

.auth-status.error {
  color: var(--color-danger);
}

.auth-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.auth-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-panel);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-btn:hover:not(:disabled) {
  border-color: var(--color-border-hover);
}

.auth-btn.primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.auth-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(37, 99, 235, 0.3);
}

.auth-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-inline-actions {
  margin-top: 6px;
  text-align: right;
}

.auth-text-btn {
  border: 0;
  color: var(--color-brand-500);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}

.auth-text-btn:hover {
  color: var(--color-brand-600);
}

.auth-footer {
  text-align: center;
  padding: 10px;
  font-size: 11px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}
</style>
