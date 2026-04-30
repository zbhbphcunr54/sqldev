import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>('system')
  const resolvedTheme = ref<ResolvedTheme>('light')

  function setTheme(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function hydrateTheme(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function setResolvedTheme(theme: ResolvedTheme): void {
    resolvedTheme.value = theme
  }

  return {
    themeMode,
    resolvedTheme,
    setTheme,
    hydrateTheme,
    setResolvedTheme
  }
})
