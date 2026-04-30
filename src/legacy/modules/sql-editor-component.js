export function registerSqlEditorComponent(app, Vue, CodeMirror) {
  app.component('sql-editor', {
    inheritAttrs: false,
    props: {
      modelValue: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      ariaLabel: { type: String, default: '' }
    },
    emits: ['update:modelValue'],
    template: '<div ref="wrap" class="sql-editor-wrap"></div>',
    setup(props, { emit, attrs }) {
      const wrap = Vue.ref(null)
      let cm = null
      let ignoreChange = false
      const changeHandler = () => {
        if (ignoreChange) return
        emit('update:modelValue', cm.getValue())
      }
      Vue.onMounted(() => {
        cm = CodeMirror(wrap.value, {
          value: props.modelValue || '',
          mode: 'text/x-sql',
          lineNumbers: true,
          lineWrapping: true,
          styleActiveLine: true,
          matchBrackets: true,
          placeholder: props.placeholder,
          indentWithTabs: false,
          tabSize: 2,
          indentUnit: 2
        })
        cm.on('change', changeHandler)
        // Forward aria-label to the actual editable textarea for accessibility.
        const label = props.ariaLabel || attrs['aria-label'] || ''
        if (label) {
          cm.getInputField().setAttribute('aria-label', label)
        }
      })
      Vue.onUnmounted(() => {
        if (cm) {
          cm.off('change', changeHandler)
          const el = cm.getWrapperElement()
          if (el && el.parentNode) {
            el.parentNode.removeChild(el)
          }
          cm = null
        }
      })
      Vue.watch(() => props.modelValue, (val) => {
        if (cm && val !== cm.getValue()) {
          ignoreChange = true
          const cursor = cm.getCursor()
          cm.setValue(val || '')
          cm.setCursor(cursor)
          ignoreChange = false
        }
      })
      return { wrap }
    }
  })
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_SQL_EDITOR = {
    registerSqlEditorComponent
  }
}
