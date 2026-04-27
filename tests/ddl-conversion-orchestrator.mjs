import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/conversion-orchestrator.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const baseDeps = {
  labels: {
    oracle: 'Oracle',
    mysql: 'MySQL',
    postgresql: 'PostgreSQL'
  },
  nowIsoString: () => '2026-04-24T10:00:00.000Z',
  parseOracleDDL: () => [],
  parseMySqlDDL: () => [],
  parsePostgresDDL: () => [],
  parseViews: () => [],
  parseExtraDDL: () => ({
    sequences: [],
    alterSequences: [],
    alterColumns: [],
    addColumns: []
  }),
  generateOracleDDL: () => '',
  generateMySqlDDL: () => '',
  generatePostgresDDL: () => '',
  generateOracleViews: () => '',
  generateMySqlViews: () => '',
  generatePostgresViews: () => '',
  generateExtraDDL: () => ''
}

assertEqual(
  ddl.convertDdlOrchestrated('', 'oracle', 'mysql', baseDeps),
  '-- 请输入 DDL 语句',
  'conversion orchestrator must reject empty input'
)

assertEqual(
  ddl.convertDdlOrchestrated('create table a(id int)', 'mysql', 'mysql', baseDeps),
  '-- 源数据库与目标数据库相同，无需转换',
  'conversion orchestrator must reject same-db conversions'
)

assertEqual(
  ddl.convertDdlOrchestrated('create table a(id int)', 'sqlite', 'mysql', baseDeps),
  '-- 不支持的源数据库: sqlite',
  'conversion orchestrator must reject unsupported source databases'
)

assertEqual(
  ddl.convertDdlOrchestrated('create table a(id int)', 'oracle', 'mysql', {
    ...baseDeps,
    parseOracleDDL: () => [{ name: 'A' }],
    generateMySqlDDL: () => 'TABLE_SQL'
  }),
  [
    '-- ============================================================',
    '-- 自动生成: Oracle -> MySQL',
    '-- 表数量: 1',
    '-- 生成时间: 2026-04-24 10:00:00',
    '-- 请检查类型映射和分区语法是否符合目标库版本要求',
    '-- ============================================================',
    '',
    'TABLE_SQL'
  ].join('\n'),
  'conversion orchestrator must generate header and table output'
)

assertEqual(
  ddl.convertDdlOrchestrated('create view v as select 1', 'oracle', 'postgresql', {
    ...baseDeps,
    parseOracleDDL: () => [],
    parseViews: () => [{ name: 'v' }],
    parseExtraDDL: () => ({
      sequences: [],
      alterSequences: [],
      alterColumns: [{ table: 'a' }],
      addColumns: []
    }),
    generatePostgresViews: () => 'VIEW_SQL',
    generateExtraDDL: () => 'EXTRA_SQL'
  }),
  [
    '-- ============================================================',
    '-- 自动生成: Oracle -> PostgreSQL',
    '-- 表数量: 0, 视图: 1（含序列/ALTER 语句）',
    '-- 生成时间: 2026-04-24 10:00:00',
    '-- 请检查类型映射和分区语法是否符合目标库版本要求',
    '-- ============================================================',
    '',
    'VIEW_SQL',
    '',
    'EXTRA_SQL'
  ].join('\n'),
  'conversion orchestrator must merge view and extra DDL outputs'
)

console.log('DDL conversion orchestrator tests passed')
