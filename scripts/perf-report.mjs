import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const distDir = path.join(root, 'dist')

function collectFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(prefix, entry.name).replace(/\\/g, '/')
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath, relativePath)
    return [{ relativePath, fullPath }]
  })
}

function gzipSize(buffer) {
  return zlib.gzipSync(buffer).length
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`
}

const files = collectFiles(distDir)
const measured = files
  .map((file) => {
    const content = fs.readFileSync(file.fullPath)
    return {
      path: file.relativePath,
      bytes: content.length,
      gzipBytes: /\.(js|css|html|svg|json)$/i.test(file.relativePath)
        ? gzipSize(content)
        : null
    }
  })
  .sort((a, b) => b.bytes - a.bytes)

const legacyVendor = measured.filter((item) => item.path.startsWith('src/legacy/vendor/'))
const legacyRuntime = measured.filter(
  (item) => item.path.startsWith('src/legacy/') && !item.path.startsWith('src/legacy/vendor/')
)

const totalBytes = measured.reduce((sum, item) => sum + item.bytes, 0)
const legacyVendorBytes = legacyVendor.reduce((sum, item) => sum + item.bytes, 0)
const legacyRuntimeBytes = legacyRuntime.reduce((sum, item) => sum + item.bytes, 0)

console.log('[perf] dist total:', formatKb(totalBytes))
console.log('[perf] copied legacy vendor:', formatKb(legacyVendorBytes), `(${legacyVendor.length} files)`)
console.log('[perf] copied legacy runtime:', formatKb(legacyRuntimeBytes), `(${legacyRuntime.length} files)`)
console.log('[perf] top 10 assets:')

for (const item of measured.slice(0, 10)) {
  const gzip = item.gzipBytes == null ? '' : ` gzip=${formatKb(item.gzipBytes)}`
  console.log(`  - ${item.path}: ${formatKb(item.bytes)}${gzip}`)
}
