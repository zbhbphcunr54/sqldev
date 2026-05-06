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
            @click.stop="showUserMenu = !showUserMenu"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 16 16">
              <circle cx="8" cy="5" r="2.5"/>
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showUserMenu" class="user-dropdown">
              <div class="dropdown-header">
                <span class="dropdown-email">{{ user?.email }}</span>
              </div>
              <div class="dropdown-divider"></div>
              <RouterLink
                to="/ai-config"
                class="dropdown-item"
                @click="showUserMenu = false"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <circle cx="7" cy="7" r="2"/>
                  <path d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12M3.64 3.64l1.06 1.06M9.3 9.3l1.06 1.06M3.64 10.36l1.06-1.06M9.3 4.7l1.06-1.06"/>
                </svg>
                AI 配置
              </RouterLink>
              <RouterLink
                to="/operation-logs"
                class="dropdown-item"
                @click="showUserMenu = false"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <path d="M2 4h10M2 7h6M2 10h8"/>
                </svg>
                操作日志
              </RouterLink>
              <RouterLink
                to="/app-config"
                class="dropdown-item"
                @click="showUserMenu = false"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <circle cx="6" cy="6" r="1.5"/>
                  <circle cx="11" cy="11" r="1.5"/>
                  <path d="M6 7.5v3M4 6h4M7.5 9h4"/>
                </svg>
                应用配置
              </RouterLink>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="handleSignOut">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 5l3 2-3 2M6 7h6"/>
                </svg>
                退出登录
              </button>
            </div>
          </Transition>
        </div>

        <!-- Login Button (Not Authenticated) -->
        <button
          v-if="!isAuthenticated"
          class="login-btn"
          type="button"
          @click="openLoginModal"
        >
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
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(8px);
}

.app-header-inner {
  max-width: 1400px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
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
  background: linear-gradient(135deg, var(--color-brand-500), #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.header-nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 14px;
  border-radius: var(--radius-control);
  font-size: 13px;
  color: var(--color-text-subtle);
  text-decoration: none;
  transition: all 0.15s;
}

.nav-link:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-link.active {
  background: var(--color-brand-50);
  color: var(--color-brand-500);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-switch {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  overflow: hidden;
}

.theme-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.theme-btn:hover {
  background: var(--color-panel-2);
}

.theme-btn.active {
  background: var(--color-brand-500);
  color: white;
}

.login-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s;
}

.login-btn:hover {
  background: var(--color-panel-2);
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
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.user-menu-trigger:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 180px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-panel);
  padding: 4px;
  z-index: 50;
}

.dropdown-header {
  padding: 8px 12px;
}

.dropdown-email {
  font-size: 12px;
  color: var(--color-text-subtle);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
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
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .header-nav {
    display: none;
  }
}
</style>
