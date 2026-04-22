import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from '@vue/eslint-config-typescript'
import prettier from '@vue/eslint-config-prettier'

export default [
  {
    name: 'app/files',
    files: ['**/*.{ts,vue}']
  },
  {
    name: 'app/ignores',
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/functions/convert/*.js'
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...tseslint(),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },
  prettier
]
