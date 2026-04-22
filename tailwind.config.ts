import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'SF Pro Text', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)'
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        panel: 'var(--shadow-panel)'
      },
      colors: {
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        panel2: 'var(--color-panel-2)',
        text: 'var(--color-text)',
        subtle: 'var(--color-text-subtle)',
        brand: {
          50: 'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)'
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        border: 'var(--color-border)'
      }
    }
  },
  plugins: []
} satisfies Config
