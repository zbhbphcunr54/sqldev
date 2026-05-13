import { EditorView } from '@codemirror/view'

export const lightTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '13px',
      backgroundColor: 'var(--color-panel, #ffffff)',
      color: 'var(--color-text, #1e293b)'
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      caretColor: 'var(--color-primary, #3b82f6)',
      padding: '12px 0'
    },
    '.cm-cursor': { borderLeftColor: 'var(--color-primary, #3b82f6)' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
    '.cm-activeLine': { backgroundColor: 'rgba(59, 130, 246, 0.04)' },
    '.cm-gutters': {
      backgroundColor: 'var(--color-panel-2, #f8fafc)',
      color: 'var(--color-text-subtle, #94a3b8)',
      border: 'none',
      borderRight: '1px solid var(--color-border, #e2e8f0)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      color: 'var(--color-text, #1e293b)'
    },
    '.cm-foldGutter': { color: 'var(--color-text-subtle, #94a3b8)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 8px', minWidth: '40px' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
    },
    '.cm-tooltip': {
      border: '1px solid var(--color-border, #e2e8f0)',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      backgroundColor: 'var(--color-panel, #ffffff)'
    },
    '.cm-tooltip-autocomplete': {
      '& > ul': { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' },
      '& > ul > li': { padding: '4px 8px' },
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--color-primary, #3b82f6)',
        color: 'white'
      }
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      outline: '1px solid rgba(59, 130, 246, 0.4)'
    },
    '.cm-searchMatch': { backgroundColor: 'rgba(255, 207, 51, 0.4)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(255, 207, 51, 0.8)' }
  },
  { dark: false }
)

export const darkTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '13px',
      backgroundColor: 'var(--color-panel, #1e1e2e)',
      color: 'var(--color-text, #cdd6f4)'
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      caretColor: 'var(--color-primary, #89b4fa)',
      padding: '12px 0'
    },
    '.cm-cursor': { borderLeftColor: 'var(--color-primary, #89b4fa)' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(137, 180, 250, 0.25)' },
    '.cm-activeLine': { backgroundColor: 'rgba(137, 180, 250, 0.06)' },
    '.cm-gutters': {
      backgroundColor: 'var(--color-panel-2, #181825)',
      color: 'var(--color-text-subtle, #6c7086)',
      border: 'none',
      borderRight: '1px solid var(--color-border, #313244)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(137, 180, 250, 0.10)',
      color: 'var(--color-text, #cdd6f4)'
    },
    '.cm-foldGutter': { color: 'var(--color-text-subtle, #6c7086)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 8px', minWidth: '40px' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
    },
    '.cm-tooltip': {
      border: '1px solid var(--color-border, #313244)',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backgroundColor: 'var(--color-panel, #1e1e2e)',
      color: 'var(--color-text, #cdd6f4)'
    },
    '.cm-tooltip-autocomplete': {
      '& > ul': { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' },
      '& > ul > li': { padding: '4px 8px' },
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--color-primary, #89b4fa)',
        color: '#1e1e2e'
      }
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(137, 180, 250, 0.2)',
      outline: '1px solid rgba(137, 180, 250, 0.5)'
    },
    '.cm-searchMatch': { backgroundColor: 'rgba(249, 226, 175, 0.3)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(249, 226, 175, 0.6)' }
  },
  { dark: true }
)
