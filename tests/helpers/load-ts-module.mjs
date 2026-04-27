import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const moduleCache = new Map()

function resolveLocalModulePath(root, importerPath, request) {
  const importerDir = path.dirname(path.join(root, importerPath))
  const basePath = path.resolve(importerDir, request)
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.mjs`,
    `${basePath}.js`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(root, candidate).replace(/\\/g, '/')
    }
  }

  return null
}

function loadInternal(relativePath, root) {
  const normalizedPath = relativePath.replace(/\\/g, '/')
  if (moduleCache.has(normalizedPath)) return moduleCache.get(normalizedPath)

  const source = fs.readFileSync(path.join(root, normalizedPath), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText

  const module = { exports: {} }
  moduleCache.set(normalizedPath, module.exports)

  const context = {
    exports: module.exports,
    module,
    require(request) {
      if (typeof request === 'string' && (request.startsWith('./') || request.startsWith('../'))) {
        const resolved = resolveLocalModulePath(root, normalizedPath, request)
        if (!resolved) {
          throw new Error(`Cannot resolve local require "${request}" from ${normalizedPath}`)
        }
        return loadInternal(resolved, root)
      }
      throw new Error(`Unexpected require while loading ${normalizedPath}`)
    },
    document: {},
    navigator: {},
    window: {}
  }

  vm.runInNewContext(transpiled, context, { filename: normalizedPath })
  moduleCache.set(normalizedPath, module.exports)
  return module.exports
}

export function loadTsModule(relativePath) {
  const root = process.cwd()
  return loadInternal(relativePath, root)
}
