import { loadTsModule } from './helpers/load-ts-module.mjs'

const { mapConvertErrorMessage } = loadTsModule('src/features/convert/error-map.ts')

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

assertEqual(
  mapConvertErrorMessage('unauthorized', 401),
  '登录状态失效，请重新登录后重试',
  '401 must ask the user to log in again'
)

assertEqual(
  mapConvertErrorMessage('engine_init_failed', 503),
  '转换引擎加载失败，请重新部署 convert 函数后重试',
  'engine_init_failed must keep a deploy-oriented diagnostic'
)

assertEqual(
  mapConvertErrorMessage('conversion_failed', 500),
  '转换执行失败，请检查 SQL 内容后重试',
  'conversion_failed must point to SQL content checks'
)

assertEqual(
  mapConvertErrorMessage('unknown', 500),
  '转换服务暂时异常，请稍后重试',
  'unknown 5xx must be sanitized'
)

assertEqual(
  mapConvertErrorMessage('unknown', 400),
  '转换请求失败，请检查输入后重试',
  'unknown 4xx must be sanitized'
)

console.log('Convert error map tests passed')
