<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated, user } = auth

const showUserMenu = ref(false)

const navItems = computed(() => [
  { to: '/', label: '首页' },
  { to: '/workbench', label: 'SQL 工作台' },
  { to: '/workbench/ziwei', label: '紫微斗数' }
])

const isNavActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

async function handleSignOut() {
  await auth.signOut()
  await router.push('/')
}

function setTheme(mode: ThemeMode) {
  appStore.setTheme(mode)
}

function openLoginModal() {
  authModal.openModal({ redirectTo: route.fullPath || '/workbench/ddl' })
}

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showUserMenu.value && !target.closest('.user-menu-container')) {
    showUserMenu.value = false
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
  <header class="app-header">
    <div class="app-header-inner">
      <!-- Brand -->
      <div class="header-brand">
        <div class="brand-logo">SQL</div>
        <span class="brand-name">SQLDev Studio</span>
      </div>

      <!-- Navigation Links -->
      <nav class="header-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isNavActive(item.to) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- Actions -->
      <div class="header-actions">
        <!-- Theme Switch -->
        <div class="theme-switch">
          <button
            class="theme-btn"
            :class="{ active: appStore.themeMode === 'light' }"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            class="theme-btn"
            :class="{ active: appStore.themeMode === 'dark' }"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            class="theme-btn"
            :class="{ active: appStore.themeMode === 'system' }"
            @click="setTheme('system')"
          >
            系统
          </button>
        </div>

        <!-- User Menu (Authenticated) -->
        <div v-if="isAuthenticated" class="user-menu-container relative">
          <button
            class="user-menu-trigger"
            title="用户菜单"
            @click.stop="showUserMenu = !showUserMenu"
          >
            <!-- 三个点图标 -->
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showUserMenu" class="user-dropdown">
              <div class="dropdown-user-info">
                <div class="dropdown-avatar">
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
                <div class="dropdown-user-text">
                  <span class="dropdown-email">{{ user?.email }}</span>
                </div>
              </div>

              <!-- 主题切换 -->
              <div class="dropdown-section-title">主题</div>
              <div class="dropdown-theme-options">
                <button
                  class="dropdown-theme-btn"
                  :class="{ active: appStore.themeMode === 'light' }"
                  @click="setTheme('light')"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <circle cx="10" cy="10" r="3" />
                    <path
                      d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
                      stroke-linecap="round"
                    />
                  </svg>
                  浅色
                </button>
                <button
                  class="dropdown-theme-btn"
                  :class="{ active: appStore.themeMode === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      d="M17.5 11.5A7.5 7.5 0 1 1 8.5 4a5 5 0 0 0 9 7.5z"
                      stroke-linecap="round"
                    />
                  </svg>
                  深色
                </button>
                <button
                  class="dropdown-theme-btn"
                  :class="{ active: appStore.themeMode === 'system' }"
                  @click="setTheme('system')"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <rect x="3" y="4" width="14" height="10" rx="2" />
                    <path d="M7 18h6M10 14v4" stroke-linecap="round" />
                  </svg>
                  系统
                </button>
              </div>

              <div class="dropdown-divider"></div>
              <RouterLink to="/ai-config" class="dropdown-item" @click="showUserMenu = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M10 3v2M10 16v2M3 10h2M16 10h2" stroke-linecap="round" />
                  <circle cx="10" cy="10" r="3" />
                  <path d="M5.5 5.5l1.4 1.4M13.1 13.1l1.4 1.4M5.5 14.5l1.4-1.4M13.1 6.9l1.4-1.4" />
                </svg>
                AI 配置
              </RouterLink>
              <RouterLink to="/operation-logs" class="dropdown-item" @click="showUserMenu = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M4 6h12M4 10h8M4 14h10" stroke-linecap="round" />
                </svg>
                操作日志
              </RouterLink>
              <RouterLink to="/app-config" class="dropdown-item" @click="showUserMenu = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <circle cx="8" cy="8" r="2" />
                  <circle cx="14" cy="14" r="2" />
                  <path d="M8 10v5M5 8h6M10 14h5" />
                </svg>
                应用配置
              </RouterLink>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="handleSignOut">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M7 5H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M13 8l4 3-4 3M9 11h8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                退出登录
              </button>
            </div>
          </Transition>
        </div>

        <!-- Login Button (Not Authenticated) -->
        <button v-if="!isAuthenticated" class="login-btn" type="button" @click="openLoginModal">
          登录 / 注册
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-height, 56px);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--color-border);
}

[data-theme='dark'] .app-header {
  background: rgba(28, 28, 30, 0.8);
}

.app-header-inner {
  max-width: 1400px;
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.header-nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-apple);
}

.nav-link:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-link.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

[data-theme='dark'] .nav-link.active {
  background: var(--color-accent-bg);
  color: var(--color-brand-500);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-switch {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--color-panel-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
}

.theme-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-subtle);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--duration-fast) var(--ease-apple);
}

.theme-btn:hover {
  color: var(--color-text);
}

.theme-btn.active {
  background: var(--color-panel);
  color: var(--color-text);
  box-shadow: var(--shadow-xs);
}

.login-btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  box-shadow: var(--shadow-button);
}

.login-btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
}

.user-menu-container {
  position: relative;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-panel);
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.user-menu-trigger:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
  transform: translateY(-1px);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 240px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 50;
}

.dropdown-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.dropdown-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-email {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  word-break: break-all;
}

.dropdown-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 12px 6px;
}

.dropdown-theme-options {
  display: flex;
  gap: 6px;
  padding: 0 6px 8px;
}

.dropdown-theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.dropdown-theme-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.dropdown-theme-btn.active {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 6px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.dropdown-item:hover {
  background: var(--color-panel-2);
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-item.danger:hover {
  background: var(--color-danger-bg);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-normal) var(--ease-spring);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

@media (max-width: 768px) {
  .header-nav {
    display: none;
  }
}
</style>
