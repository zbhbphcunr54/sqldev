import { loadTsModule } from './helpers/load-ts-module.mjs'

const sections = loadTsModule('src/features/navigation/workbench-sections.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    )
  }
}

assertEqual(sections.WORKBENCH_DEFAULT_SECTION, 'sql-convert', 'default workbench section must be sql-convert')
assertEqual(sections.normalizeWorkbenchSection('ziwei'), 'ziwei', 'known section must be preserved')
assertEqual(
  sections.normalizeWorkbenchSection(['id-tool']),
  'id-tool',
  'route param arrays must normalize'
)
assertEqual(
  sections.normalizeWorkbenchSection('unknown'),
  'sql-convert',
  'unknown section must fallback to sql-convert'
)
assertEqual(
  sections.buildWorkbenchPath('ai-config'),
  '/workbench/ai-config',
  'path builder must preserve mapped section'
)
assertEqual(
  sections.WORKBENCH_SECTION_NAV_ITEMS.map((item) => item.section),
  sections.WORKBENCH_SECTIONS,
  'sidebar nav items must cover every supported section in order'
)

console.log('Workbench section navigation tests passed')
