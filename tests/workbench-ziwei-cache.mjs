import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = fs.readFileSync(
  path.join(root, 'src/components/business/workbench/WorkbenchApp.vue'),
  'utf8'
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  source.includes('const KeepAliveZiweiPage = defineComponent'),
  'WorkbenchApp must declare a dedicated Ziwei keep-alive wrapper component'
)

assert(
  source.includes("name: 'KeepAliveZiweiPage'"),
  'WorkbenchApp must give the Ziwei keep-alive wrapper a stable component name'
)

assert(
  source.includes('<KeepAlive :key="ziweiCacheScope" include="KeepAliveZiweiPage" :max="1">'),
  'WorkbenchApp must keep the Ziwei page cached and scope that cache to the current user'
)

assert(
  source.includes("store.activePage === 'ziweiTool'") &&
    source.includes('auth.canAccessZiweiTool.value ? KeepAliveZiweiPage : null'),
  'WorkbenchApp must render the cached Ziwei page only when the active page is ziweiTool and access is allowed'
)

console.log('Workbench Ziwei cache tests passed')
