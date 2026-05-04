<!-- src/components/business/workbench/components/SqlEditor.vue -->
<!-- SQL 编辑器组件，基于 CodeMirror 6 -->
<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
  scrollPastEnd,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from '@codemirror/language'
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { sql, SQLDialect, PLSQL, PostgreSQL, MySQL } from '@codemirror/lang-sql'

// Props
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    readonly?: boolean
    language?: 'oracle' | 'mysql' | 'postgresql' | 'sql'
  }>(),
  {
    readonly: false,
    language: 'sql'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const view = shallowRef<EditorView | null>(null)
const currentTheme = ref<'light' | 'dark'>('light')
let themeObserver: MutationObserver | null = null

// SQL 关键字补全
const sqlKeywords = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
  'LIKE', 'IS', 'NULL', 'AS', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
  'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP',
  'ALTER', 'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'BEGIN', 'END',
  'DECLARE', 'IF', 'THEN', 'ELSE', 'ELSIF', 'CASE', 'WHEN', 'WHILE', 'LOOP',
  'RETURN', 'RAISE', 'EXCEPTION', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'UNIQUE', 'CHECK', 'DEFAULT', 'CONSTRAINT', 'CASCADE', 'RESTRICT',
  'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'MINUS', 'ANY', 'SOME',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROWID', 'ROWNUM', 'SYSDATE', 'SYSTIMESTAMP',
  'VARCHAR', 'VARCHAR2', 'CHAR', 'NUMBER', 'INTEGER', 'INT', 'BIGINT', 'SMALLINT',
  'DECIMAL', 'FLOAT', 'DOUBLE', 'DATE', 'DATETIME', 'TIMESTAMP', 'BLOB', 'CLOB', 'TEXT',
  'BOOLEAN', 'SERIAL', 'BIGSERIAL', 'UUID', 'JSON', 'JSONB',
  'CAST', 'COALESCE', 'NVL', 'NVL2', 'DECODE', 'TO_CHAR', 'TO_NUMBER', 'TO_DATE',
  'TRUNC', 'ROUND', 'MOD', 'POWER', 'SQRT', 'ABS', 'LENGTH', 'SUBSTR', 'SUBSTRING',
  'TRIM', 'LTRIM', 'RTRIM', 'UPPER', 'LOWER', 'INITCAP', 'INSTR', 'LPAD', 'RPAD',
  'CONCAT', 'REPLACE', 'TRANSLATE', 'REGEXP', 'REGEXP_LIKE',
  'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE',
  'OVER', 'PARTITION', 'RANGE', 'ROWS', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED',
  'WITH', 'RECURSIVE', 'CTE', 'MATERIALIZED',
  'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'LOCK', 'TABLE', 'SEQUENCE', 'SYNONYM', 'PACKAGE', 'TYPE', 'BODY',
  'OUT', 'INOUT', 'CURSOR', 'BULK', 'COLLECT', 'FORALL',
  'EXPLAIN', 'PLAN', 'ANALYZE', 'EXPLAIN PLAN',
]

function sqlCompletion(context: CompletionContext) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  return {
    from: word.from,
    options: sqlKeywords.map((kw) => ({
      label: kw,
      type: 'keyword',
      detail: 'SQL',
    })),
  }
}

// 方言映射
function getDialect(): SQLDialect | undefined {
  switch (props.language) {
    case 'oracle':
      return PLSQL
    case 'mysql':
      return MySQL
    case 'postgresql':
      return PostgreSQL
    default:
      return undefined
  }
}

// 检测当前主题
function getCurrentTheme(): 'light' | 'dark' {
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  // 检查 class
  if (document.documentElement.classList.contains('dark')) return 'dark'
  return 'light'
}

// 浅色主题
const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'var(--color-panel, #ffffff)',
    color: 'var(--color-text, #1e293b)',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    caretColor: 'var(--color-primary, #3b82f6)',
    padding: '12px 0',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-primary, #3b82f6)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-panel-2, #f8fafc)',
    color: 'var(--color-text-subtle, #94a3b8)',
    border: 'none',
    borderRight: '1px solid var(--color-border, #e2e8f0)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    color: 'var(--color-text, #1e293b)',
  },
  '.cm-foldGutter': {
    color: 'var(--color-text-subtle, #94a3b8)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
    minWidth: '40px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  },
  '.cm-tooltip': {
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    backgroundColor: 'var(--color-panel, #ffffff)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    },
    '& > ul > li': {
      padding: '4px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'var(--color-primary, #3b82f6)',
      color: 'white',
    },
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    outline: '1px solid rgba(59, 130, 246, 0.4)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 207, 51, 0.4)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 207, 51, 0.8)',
  },
}, { dark: false })

// 深色主题
const darkTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'var(--color-panel, #1e1e2e)',
    color: 'var(--color-text, #cdd6f4)',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    caretColor: 'var(--color-primary, #89b4fa)',
    padding: '12px 0',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-primary, #89b4fa)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(137, 180, 250, 0.25)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(137, 180, 250, 0.06)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-panel-2, #181825)',
    color: 'var(--color-text-subtle, #6c7086)',
    border: 'none',
    borderRight: '1px solid var(--color-border, #313244)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(137, 180, 250, 0.10)',
    color: 'var(--color-text, #cdd6f4)',
  },
  '.cm-foldGutter': {
    color: 'var(--color-text-subtle, #6c7086)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
    minWidth: '40px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  },
  '.cm-tooltip': {
    border: '1px solid var(--color-border, #313244)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    backgroundColor: 'var(--color-panel, #1e1e2e)',
    color: 'var(--color-text, #cdd6f4)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    },
    '& > ul > li': {
      padding: '4px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'var(--color-primary, #89b4fa)',
      color: '#1e1e2e',
    },
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(137, 180, 250, 0.2)',
    outline: '1px solid rgba(137, 180, 250, 0.5)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(249, 226, 175, 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(249, 226, 175, 0.6)',
  },
}, { dark: true })

// 获取当前主题扩展
function getThemeExtension() {
  return currentTheme.value === 'dark' ? darkTheme : lightTheme
}

// 重建编辑器（保留内容）
function rebuildEditor() {
  if (!editorRef.value || !view.value) return

  const content = view.value.state.doc.toString()
  const scrollTop = view.value.scrollDOM.scrollTop

  view.value.destroy()

  const state = EditorState.create({
    doc: content,
    extensions: [
      ...baseExtensions(),
      EditorState.readOnly.of(props.readonly),
    ],
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value,
  })

  // 恢复滚动位置
  requestAnimationFrame(() => {
    if (view.value) {
      view.value.scrollDOM.scrollTop = scrollTop
    }
  })
}

// 基础扩展
function baseExtensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    autocompletion({
      override: [sqlCompletion],
      activateOnTyping: true,
    }),
    scrollPastEnd(),
    keymap.of([
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...lintKeymap,
      // Ctrl/Cmd + Enter 提交
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: () => {
          emit('submit')
          return true
        },
      },
      {
        key: 'Mod-Enter',
        run: () => {
          emit('submit')
          return true
        },
      },
    ]),
    sql({ dialect: getDialect() }),
    getThemeExtension(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
  ]
}

// 初始化编辑器
onMounted(() => {
  if (!editorRef.value) return

  // 检测初始主题
  currentTheme.value = getCurrentTheme()

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      ...baseExtensions(),
      EditorState.readOnly.of(props.readonly),
    ],
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value,
  })

  // 监听主题变化
  themeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-theme') {
        const newTheme = getCurrentTheme()
        if (newTheme !== currentTheme.value) {
          currentTheme.value = newTheme
          rebuildEditor()
        }
      }
    }
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  // 也监听 class 变化（兼容 dark class）
  const classObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        const newTheme = getCurrentTheme()
        if (newTheme !== currentTheme.value) {
          currentTheme.value = newTheme
          rebuildEditor()
        }
      }
    }
  })
  classObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

// 清理
onUnmounted(() => {
  view.value?.destroy()
  view.value = null
  themeObserver?.disconnect()
})

// 外部值变化时更新编辑器
watch(
  () => props.modelValue,
  (newVal) => {
    if (!view.value) return
    const current = view.value.state.doc.toString()
    if (newVal !== current) {
      view.value.dispatch({
        changes: { from: 0, to: view.value.state.doc.length, insert: newVal },
      })
    }
  }
)

// 只读状态变化 - 使用重建方式
watch(
  () => props.readonly,
  () => {
    rebuildEditor()
  }
)

// 语言变化时重建
watch(
  () => props.language,
  () => {
    rebuildEditor()
  }
)

// 暴露方法
function focus() {
  view.value?.focus()
}

function getContent(): string {
  return view.value?.state.doc.toString() ?? ''
}

function setContent(content: string) {
  if (!view.value) return
  view.value.dispatch({
    changes: { from: 0, to: view.value.state.doc.length, insert: content },
  })
}

function getLineCount(): number {
  return view.value?.state.doc.lines ?? 0
}

defineExpose({
  focus,
  getContent,
  setContent,
  getLineCount,
})
</script>

<template>
  <div ref="editorRef" class="sql-editor" />
</template>

<style scoped>
.sql-editor {
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-panel);
}

.sql-editor :deep(.cm-editor) {
  height: 100%;
}

.sql-editor :deep(.cm-scroller) {
  overflow: auto;
}

/* 深色模式覆盖 */
:global([data-theme='dark']) .sql-editor {
  background: var(--color-panel, #1e1e2e);
}

:global(.dark) .sql-editor {
  background: var(--color-panel, #1e1e2e);
}
</style>
