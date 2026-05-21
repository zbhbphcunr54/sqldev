<script setup lang="ts">
import { useAuthForm } from '@/composables/useAuthForm'

const {
  open,
  loginMode,
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
  setLoginMode
} = useAuthForm()
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
            @click="setLoginMode('password')"
          >
            密码登录
          </button>
          <button
            class="auth-mode-btn"
            :class="{ active: loginMode === 'code' }"
            type="button"
            role="tab"
            :aria-selected="loginMode === 'code'"
            @click="setLoginMode('code')"
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
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.auth-modal {
  width: min(92vw, 472px);
  max-width: 472px;
  max-height: min(90vh, 760px);
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: auto;
}

.auth-modal-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 28px 0;
  text-align: center;
  position: relative;
}

.auth-modal-logo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--color-accent);
  display: grid;
  place-items: center;
  font-family: var(--font-code);
  font-size: 12px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.auth-modal-head h3 {
  margin: 0;
  max-width: 100%;
  padding: 0 24px;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.auth-modal-desc {
  max-width: 360px;
  margin: 10px auto 0;
  padding: 0 28px;
  color: var(--color-text-subtle);
  font-size: 13px;
  line-height: 1.65;
  text-align: center;
  text-wrap: balance;
  box-sizing: border-box;
}

.auth-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-apple);
}

.auth-close:hover {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.auth-mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin: 18px 24px 0;
  background: var(--color-panel-2);
  border-radius: var(--radius-md);
}

.auth-mode-btn {
  flex: 1;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.auth-mode-btn:hover {
  color: var(--color-text);
}

.auth-mode-btn.active {
  background: var(--color-panel);
  color: var(--color-text);
  box-shadow: var(--shadow-xs);
}

.auth-form {
  padding: 20px 24px 24px;
}

.auth-label {
  display: block;
  margin-bottom: 5px;
  color: var(--color-text-subtle);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.auth-input {
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.35;
  outline: none;
  transition: all var(--duration-fast) var(--ease-apple);
  box-sizing: border-box;
}

.auth-input-password {
  padding-right: 40px;
}

.auth-input::placeholder {
  color: var(--color-text-muted);
}

.auth-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
  background: var(--color-panel);
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
  right: 12px;
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transform: translateY(-50%);
  transition: color var(--duration-fast) var(--ease-apple);
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
  width: 12px;
  height: 2px;
  background: currentColor;
  transform: rotate(-35deg) scaleX(0);
  transition: transform var(--duration-fast) var(--ease-apple);
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
  line-height: 1.45;
}

.auth-status {
  min-height: 18px;
  margin: 10px 0 0;
  color: var(--color-success);
}

.auth-status.error {
  color: var(--color-danger);
}

.auth-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.auth-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-text);
  background: var(--color-panel-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.auth-btn:hover:not(:disabled) {
  background: var(--color-panel-3);
}

.auth-btn.primary {
  border: none;
  color: var(--color-btn-primary-text);
  background: var(--color-accent);
  box-shadow: var(--shadow-button);
}

.auth-btn.primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
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
  color: var(--color-accent);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 4px;
  transition: color var(--duration-fast) var(--ease-apple);
}

.auth-text-btn:hover {
  color: var(--color-accent-hover);
}

.auth-footer {
  text-align: center;
  padding: 12px;
  font-size: 11px;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

@media (max-width: 640px) {
  .auth-modal {
    width: min(94vw, 420px);
    max-width: 420px;
  }

  .auth-modal-head {
    padding: 22px 20px 0;
  }

  .auth-modal-head h3 {
    padding: 0 20px;
    font-size: 18px;
  }

  .auth-modal-desc {
    max-width: 100%;
    padding: 0 20px;
    font-size: 12px;
    line-height: 1.55;
  }

  .auth-mode-switch {
    margin: 16px 20px 0;
  }

  .auth-form {
    padding: 18px 20px 20px;
  }
}
</style>
