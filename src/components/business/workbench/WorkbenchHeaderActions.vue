<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const router = useRouter()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated, user } = auth

const showMenu = ref(false)

function setTheme(mode: ThemeMode) {
  appStore.setTheme(mode)
}

function openLoginModal() {
  authModal.openModal({ redirectTo: '/workbench/ddl' })
}

async function handleSignOut() {
  showMenu.value = false
  await auth.signOut()
  await router.push('/')
}

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showMenu.value && !target.closest('.wb-header-actions')) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <!-- 用户菜单（已登录） -->
  <div v-if="isAuthenticated" class="wb-header-actions">
    <button
      class="wb-header-trigger"
      title="菜单"
      @click.stop="showMenu = !showMenu"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="3" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="8" cy="13" r="1.5" />
      </svg>
    </button>
    <Transition name="dropdown">
      <div v-if="showMenu" class="wb-dropdown">
        <div class="wb-dropdown-user">
          <div class="wb-dropdown-avatar">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <circle cx="8" cy="5" r="3" />
              <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
          </div>
          <div class="wb-dropdown-user-text">
            <span class="wb-dropdown-email">{{ user?.email }}</span>
          </div>
        </div>

        <div class="wb-dropdown-section">主题</div>
        <div class="wb-dropdown-theme">
          <button
            class="wb-theme-btn"
            :class="{ active: appStore.themeMode === 'light' }"
            @click="setTheme('light')"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="10" cy="10" r="3" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke-linecap="round" />
            </svg>
            浅色
          </button>
          <button
            class="wb-theme-btn"
            :class="{ active: appStore.themeMode === 'dark' }"
            @click="setTheme('dark')"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 4a5 5 0 0 0 9 7.5z" stroke-linecap="round" />
            </svg>
            深色
          </button>
          <button
            class="wb-theme-btn"
            :class="{ active: appStore.themeMode === 'system' }"
            @click="setTheme('system')"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="14" height="10" rx="2" />
              <path d="M7 18h6M10 14v4" stroke-linecap="round" />
            </svg>
            系统
          </button>
        </div>

        <div class="wb-dropdown-divider"></div>
        <button class="wb-dropdown-item danger" @click="handleSignOut">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 5H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M13 8l4 3-4 3M9 11h8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          退出登录
        </button>
      </div>
    </Transition>
  </div>

  <!-- 登录按钮（未登录） -->
  <button v-else class="wb-login-btn" type="button" @click="openLoginModal">
    登录 / 注册
  </button>
</template>

<style scoped>
.wb-header-actions {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
}

.wb-header-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
}

.wb-header-trigger:hover {
  background: var(--color-panel-2);
  color: var(--color-page-text);
  border-color: var(--color-page-border-hover);
}

.wb-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 200px;
  background: var(--color-panel);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: 8px;
}

.wb-dropdown-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
}

.wb-dropdown-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-page-brand);
  color: var(--color-btn-primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-dropdown-user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-dropdown-email {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-page-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.wb-dropdown-section {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px 4px;
}

.wb-dropdown-theme {
  display: flex;
  gap: 4px;
  padding: 0 4px 8px;
}

.wb-theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-page-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.wb-theme-btn:hover {
  border-color: var(--color-page-brand);
  color: var(--color-page-brand-hover);
}

.wb-theme-btn.active {
  border-color: var(--color-page-brand);
  background: var(--color-page-brand-bg);
  color: var(--color-page-brand-hover);
}

.wb-dropdown-divider {
  height: 1px;
  background: var(--color-page-border-subtle);
  margin: 4px 0;
}

.wb-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-page-text);
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.wb-dropdown-item:hover {
  background: var(--color-page-elevated);
}

.wb-dropdown-item.danger {
  color: var(--color-page-danger);
}

.wb-dropdown-item.danger:hover {
  background: var(--color-page-danger-bg);
}

.wb-login-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 100;
  padding: 8px 14px;
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  color: var(--color-page-text);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
}

.wb-login-btn:hover {
  background: var(--color-panel-2);
  border-color: var(--color-page-border-hover);
}

/* 动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
