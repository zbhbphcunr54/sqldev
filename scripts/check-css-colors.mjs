import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const baselinePath = path.join(root, 'scripts/css-color-baseline.json')
const updateMode = process.argv.includes('--update')

const targets = [
  path.join(root, 'src/components'),
  path.join(root, 'src/layouts'),
  path.join(root, 'src/pages'),
  path.join(root, 'src/styles')
]

const colorPattern =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath)
    if (!/\.(css|vue)$/i.test(entry.name)) return []
    return [fullPath]
  })
}

function normalizeRecord(record) {
  return `${record.file}:${record.line}:${record.color}:${record.text}`
}

function scan() {
  const files = targets.flatMap(collectFiles)
  const records = []

  for (const file of files) {
    const relativeFile = path.relative(root, file).replace(/\\/g, '/')
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const matches = line.match(colorPattern)
      if (!matches) continue
      for (const color of matches) {
        records.push({
          file: relativeFile,
          line: index + 1,
          color,
          text: line.trim().slice(0, 160)
        })
      }
    }
  }

  return records.sort((a, b) => normalizeRecord(a).localeCompare(normalizeRecord(b)))
}

const current = scan()

if (updateMode) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
  console.log(`CSS color baseline updated: ${current.length} records`)
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  throw new Error('Missing scripts/css-color-baseline.json. Run pnpm check:css-colors:update first.')
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const baselineSet = new Set(baseline.map(normalizeRecord))
const currentSet = new Set(current.map(normalizeRecord))
const added = current.filter((record) => !baselineSet.has(normalizeRecord(record)))
const removed = baseline.filter((record) => !currentSet.has(normalizeRecord(record)))

if (added.length || removed.length) {
  console.error('CSS hardcoded color baseline changed.')
  if (added.length) {
    console.error('\nNew hardcoded colors:')
    for (const record of added) console.error(`  + ${normalizeRecord(record)}`)
  }
  if (removed.length) {
    console.error('\nRemoved baseline colors:')
    for (const record of removed) console.error(`  - ${normalizeRecord(record)}`)
  }
  console.error('\nIf this is intentional, replace with design tokens or run pnpm check:css-colors:update.')
  process.exit(1)
}

console.log(`CSS hardcoded color baseline unchanged: ${current.length} records`)
