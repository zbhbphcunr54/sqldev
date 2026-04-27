import { strict as assert } from 'node:assert'
import { loadTsModule } from './helpers/load-ts-module.mjs'

const mod = loadTsModule('src/features/routines/conversion-orchestrator.ts')
const { convertFunctionOrchestrated, convertProcedureOrchestrated } = mod

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log('  ✓', name)
    passed++
  } catch (error) {
    console.error('  ✗', name)
    console.error('   ', error.message)
    failed++
  }
}

const labels = {
  oracle: 'Oracle',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL'
}

console.log('routine-conversion-orchestrator')

test('function orchestrator: empty input guard', () => {
  const result = convertFunctionOrchestrated('', 'oracle', 'mysql', {
    labels,
    convertSingleFunction: () => 'noop'
  })
  assert.equal(result, '-- 请在左侧输入区粘贴源函数定义')
})

test('function orchestrator: same db short-circuit', () => {
  const result = convertFunctionOrchestrated('  CREATE FUNCTION f() RETURN NUMBER;  ', 'oracle', 'oracle', {
    labels,
    convertSingleFunction: () => 'noop'
  })
  assert.ok(result.includes('-- 源库与目标库相同 (Oracle)，无需翻译'))
  assert.ok(result.endsWith('CREATE FUNCTION f() RETURN NUMBER;'))
})

test('function orchestrator: converts blocks and reports failures', () => {
  const result = convertFunctionOrchestrated(
    'CREATE FUNCTION ok() RETURN NUMBER;\nCREATE FUNCTION bad() RETURN NUMBER;',
    'oracle',
    'mysql',
    {
      labels,
      nowIsoString: () => '2026-04-24T12:00:00.000Z',
      convertSingleFunction: (block) => {
        if (block.includes('bad')) throw new Error('boom')
        return '-- converted: ok'
      }
    }
  )
  assert.ok(result.includes('-- 函数翻译: Oracle → MySQL | 共 2 个函数 (1 个失败) | 2026-04-24 12:00:00'))
  assert.ok(result.includes('-- converted: ok'))
  assert.ok(result.includes('-- 翻译失败: boom'))
})

test('procedure orchestrator: empty input guard', () => {
  const result = convertProcedureOrchestrated('', 'oracle', 'mysql', {
    labels,
    convertSingleProcedure: () => 'noop'
  })
  assert.equal(result, '-- 请在左侧输入区粘贴源存储过程定义')
})

test('procedure orchestrator: converts blocks and reports failures', () => {
  const result = convertProcedureOrchestrated(
    'CREATE PROCEDURE ok();\nCREATE PROCEDURE bad();',
    'mysql',
    'postgresql',
    {
      labels,
      nowIsoString: () => '2026-04-24T12:30:00.000Z',
      convertSingleProcedure: (block) => {
        if (block.includes('bad')) throw new Error('nope')
        return '-- converted: ok'
      }
    }
  )
  assert.ok(
    result.includes('-- 存储过程翻译: MySQL → PostgreSQL | 共 2 个存储过程 (1 个失败) | 2026-04-24 12:30:00')
  )
  assert.ok(result.includes('-- converted: ok'))
  assert.ok(result.includes('-- 翻译失败: nope'))
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
