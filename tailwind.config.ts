import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'JetBrains Mono', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: 'var(--radius-pill)',
        card: 'var(--radius-card)'
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)'
      },
      colors: {
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        panel2: 'var(--color-panel-2)',
        panel3: 'var(--color-panel-3)',
        text: 'var(--color-text)',
        subtle: 'var(--color-text-subtle)',
        muted: 'var(--color-text-muted)',
        brand: {
          50: 'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)',
          400: 'var(--color-brand-400)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)'
        },
        success: 'var(--color-success)',
        successBg: 'var(--color-success-bg)',
        warning: 'var(--color-warning)',
        warningBg: 'var(--color-warning-bg)',
        danger: 'var(--color-danger)',
        dangerBg: 'var(--color-danger-bg)',
        purple: 'var(--color-purple)',
        purpleBg: 'var(--color-purple-bg)',
        border: 'var(--color-border)',
        borderHover: 'var(--color-border-hover)',
        accent: 'var(--color-accent)',
        accentBg: 'var(--color-accent-bg)'
      },
      transitionTimingFunction: {
        apple: 'var(--ease-apple)',
        spring: 'var(--ease-spring)',
        out: 'var(--ease-out)'
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)'
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)'
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)'
      }
    }
  },
  plugins: []
} satisfies Config
