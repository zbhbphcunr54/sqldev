import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist'])
const TEXT_EXTS = new Set([
  '.html',
  '.css',
  '.js',
  '.ts',
  '.vue',
  '.json',
  '.md',
  '.toml',
  '.sql',
  '.mjs',
  '.cjs',
  '.yml',
  '.yaml'
])

function isUtf8(buffer) {
  const decoded = buffer.toString('utf8')
  const encoded = Buffer.from(decoded, 'utf8')
  if (!buffer.equals(encoded)) return false
  if (decoded.includes('\uFFFD')) return false
  return true
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      walk(full, out)
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!TEXT_EXTS.has(ext)) continue
    out.push(full)
  }
  return out
}

const files = walk(ROOT)
const invalidFiles = []

for (const file of files) {
  const bytes = fs.readFileSync(file)
  if (!isUtf8(bytes)) invalidFiles.push(path.relative(ROOT, file))
}

if (invalidFiles.length > 0) {
  console.error('UTF-8 check failed for files:')
  for (const file of invalidFiles) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`UTF-8 check passed: ${files.length} text files`)
