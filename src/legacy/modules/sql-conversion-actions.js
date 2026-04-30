function hasText(refValue) {
  return !!(refValue && String(refValue.value || '').trim())
}

function createPairActions(config, deps) {
  async function swap() {
    if (
      (hasText(config.input) || hasText(config.output)) &&
      !(await deps.showConfirm(
        '交换确认',
        '输入/输出区域存在未保存内容，交换后将覆盖，是否继续？'
      ))
    ) {
      return
    }
    var dbTmp = config.sourceDb.value
    config.sourceDb.value = config.targetDb.value
    config.targetDb.value = dbTmp
    var textTmp = config.input.value
    config.input.value = config.output.value
    config.output.value = textTmp
    deps.statusText.value = '已交换: ' + config.sourceLabel.value + ' → ' + config.targetLabel.value
  }

  function loadSample() {
    config.input.value =
      (config.samples ? config.samples[config.sourceDb.value] : '') ||
      '-- 暂无 ' + config.sourceLabel.value + ' ' + config.sampleName + '示例'
    config.output.value = ''
    deps.statusText.value = '已加载 ' + config.sourceLabel.value + ' ' + config.sampleName + '示例'
  }

  function clear() {
    config.input.value = ''
    config.output.value = ''
    deps.statusText.value = '已清空'
  }

  async function convert() {
    try {
      if (!String(config.input.value || '').trim()) {
        deps.statusText.value = '请输入待转换的' + config.emptyLabel + ' SQL'
        return
      }
      if (!(await deps.ensureLogin())) {
        deps.statusText.value = '请登录后继续使用翻译功能'
        return
      }
      deps.statusText.value = config.runningLabel + '转换中，请稍候...'
      var result = await deps.backendConvert(
        config.kind,
        config.input.value,
        config.sourceDb.value,
        config.targetDb.value
      )
      config.output.value = result
      var cls = deps.classifyResult(result)
      deps.statusText.value =
        cls.level === 'error'
          ? cls.summary
          : cls.level === 'info'
            ? cls.summary
            : cls.level === 'warning'
              ? config.doneLabel +
                ': ' +
                config.sourceLabel.value +
                ' → ' +
                config.targetLabel.value +
                ' (' +
                cls.summary +
                ')'
              : config.doneLabel + ': ' + config.sourceLabel.value + ' → ' + config.targetLabel.value
    } catch (e) {
      config.output.value = '-- 转换异常: ' + e.message
      deps.statusText.value = '转换异常: ' + e.message
    }
  }

  function copyOutput() {
    deps.clipboardWrite(config.output.value)
  }

  function saveOutput() {
    deps.saveFile(config.output.value, config.filePrefix, config.targetDb.value)
  }

  return { swap, loadSample, clear, convert, copyOutput, saveOutput }
}

export function createSqlConversionActions(options) {
  var ddl = createPairActions(
    {
      kind: 'ddl',
      input: options.inputDdl,
      output: options.outputDdl,
      sourceDb: options.sourceDb,
      targetDb: options.targetDb,
      sourceLabel: options.sourceLabel,
      targetLabel: options.targetLabel,
      samples: options.ddlSamples,
      sampleName: 'DDL ',
      emptyLabel: ' DDL',
      runningLabel: 'DDL ',
      doneLabel: 'DDL 翻译完成',
      filePrefix: 'ddl'
    },
    options
  )

  var func = createPairActions(
    {
      kind: 'func',
      input: options.funcInput,
      output: options.funcOutput,
      sourceDb: options.funcSourceDb,
      targetDb: options.funcTargetDb,
      sourceLabel: options.funcSourceLabel,
      targetLabel: options.funcTargetLabel,
      samples: options.funcSamples,
      sampleName: '函数',
      emptyLabel: '函数',
      runningLabel: '函数',
      doneLabel: '函数翻译完成',
      filePrefix: 'func'
    },
    options
  )

  var proc = createPairActions(
    {
      kind: 'proc',
      input: options.procInput,
      output: options.procOutput,
      sourceDb: options.procSourceDb,
      targetDb: options.procTargetDb,
      sourceLabel: options.procSourceLabel,
      targetLabel: options.procTargetLabel,
      samples: options.procSamples,
      sampleName: '存储过程',
      emptyLabel: '存储过程',
      runningLabel: '存储过程',
      doneLabel: '存储过程翻译完成',
      filePrefix: 'proc'
    },
    options
  )

  return {
    swapDbs: ddl.swap,
    loadSample: ddl.loadSample,
    clearAll: ddl.clear,
    convert: ddl.convert,
    copyOutput: ddl.copyOutput,
    saveOutput: ddl.saveOutput,
    swapFuncDbs: func.swap,
    loadFuncSample: func.loadSample,
    clearFunc: func.clear,
    convertFunc: func.convert,
    copyFuncOutput: func.copyOutput,
    saveFuncOutput: func.saveOutput,
    swapProcDbs: proc.swap,
    loadProcSample: proc.loadSample,
    clearProc: proc.clear,
    convertProc: proc.convert,
    copyProcOutput: proc.copyOutput,
    saveProcOutput: proc.saveOutput
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_SQL_CONVERSION_ACTIONS = {
    createSqlConversionActions
  }
}
