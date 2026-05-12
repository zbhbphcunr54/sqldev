<!-- src/components/business/workbench/components/SqlEditor.vue -->
<!-- SQL 编辑器组件，基于 CodeMirror 6 -->
<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
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
  scrollPastEnd
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput
} from '@codemirror/language'
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { sql, SQLDialect, PLSQL, PostgreSQL, MySQL } from '@codemirror/lang-sql'
import { SQL_KEYWORDS } from '@/features/sql/keywords'
import { lightTheme, darkTheme } from '@/features/sql/editor-themes'

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
    language: 'sql',
    placeholder: ''
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

// 主题切换使用 Compartment，避免重建编辑器
const themeCompartment = new Compartment()

function sqlCompletion(context: CompletionContext) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  return {
    from: word.from,
    options: SQL_KEYWORDS.map((kw) => ({
      label: kw,
      type: 'keyword',
      detail: 'SQL'
    }))
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

// 动态切换主题（使用 Compartment，无需重建编辑器）
function switchTheme(newTheme: 'light' | 'dark') {
  if (!view.value) return
  currentTheme.value = newTheme
  view.value.dispatch({
    effects: themeCompartment.reconfigure(newTheme === 'dark' ? darkTheme : lightTheme)
  })
}

// 重建编辑器（保留内容）- 仅用于语言/只读状态变化
function rebuildEditor() {
  if (!editorRef.value || !view.value) return

  const content = view.value.state.doc.toString()
  const scrollTop = view.value.scrollDOM.scrollTop

  view.value.destroy()

  const state = EditorState.create({
    doc: content,
    extensions: [...baseExtensions(), EditorState.readOnly.of(props.readonly)]
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value
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
      activateOnTyping: true
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
        }
      },
      {
        key: 'Mod-Enter',
        run: () => {
          emit('submit')
          return true
        }
      }
    ]),
    sql({ dialect: getDialect() }),
    themeCompartment.of(currentTheme.value === 'dark' ? darkTheme : lightTheme),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    })
  ]
}

// 初始化编辑器
onMounted(() => {
  if (!editorRef.value) return

  // 检测初始主题
  currentTheme.value = getCurrentTheme()

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [...baseExtensions(), EditorState.readOnly.of(props.readonly)]
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value
  })

  // 监听主题变化
  themeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-theme') {
        const newTheme = getCurrentTheme()
        if (newTheme !== currentTheme.value) {
          switchTheme(newTheme)
        }
      }
    }
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  // 也监听 class 变化（兼容 dark class）
  const classObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        const newTheme = getCurrentTheme()
        if (newTheme !== currentTheme.value) {
          switchTheme(newTheme)
        }
      }
    }
  })
  classObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

// 清理
onUnmounted(() => {
  view.value?.destroy()
  view.value = null
  themeObserver?.disconnect()
  classObserver?.disconnect()
})

// 外部值变化时更新编辑器
watch(
  () => props.modelValue,
  (newVal) => {
    if (!view.value) return
    const current = view.value.state.doc.toString()
    if (newVal !== current) {
      view.value.dispatch({
        changes: { from: 0, to: view.value.state.doc.length, insert: newVal }
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
    changes: { from: 0, to: view.value.state.doc.length, insert: content }
  })
}

function getLineCount(): number {
  return view.value?.state.doc.lines ?? 0
}

defineExpose({
  focus,
  getContent,
  setContent,
  getLineCount
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
