import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>('light')
  const resolvedTheme = ref<ResolvedTheme>('light')

  function setTheme(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function setResolvedTheme(theme: ResolvedTheme): void {
    resolvedTheme.value = theme
  }

  return {
    themeMode,
    resolvedTheme,
    setTheme,
    setResolvedTheme
  }
})
