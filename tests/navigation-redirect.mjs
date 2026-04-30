import { loadTsModule } from './helpers/load-ts-module.mjs'

const redirect = loadTsModule('src/features/navigation/redirect.ts')

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

assertEqual(
  redirect.sanitizeInternalRedirectPath('/workbench/ziwei?tab=chart'),
  '/workbench/ziwei?tab=chart',
  'internal workbench redirect must be allowed'
)
assertEqual(
  redirect.sanitizeInternalRedirectPath('https://evil.example/phish'),
  '/workbench',
  'absolute URL redirect must be rejected'
)
assertEqual(
  redirect.sanitizeInternalRedirectPath('//evil.example/phish'),
  '/workbench',
  'protocol-relative redirect must be rejected'
)
assertEqual(
  redirect.sanitizeInternalRedirectPath('/%5C%5Cevil.example'),
  '/workbench',
  'encoded backslash redirect must be rejected'
)

console.log('Navigation redirect tests passed')
