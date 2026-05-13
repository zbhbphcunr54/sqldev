import { loadTsModule } from './helpers/load-ts-module.mjs'

const cityData = loadTsModule('src/features/ziwei/city-longitude.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const defaults = cityData.getDefaultProvinceCity()
assert(typeof defaults.province === 'string' && defaults.province.length > 0, 'default province should exist')
assert(typeof defaults.city === 'string' && defaults.city.length > 0, 'default city should exist')
assert(typeof defaults.longitude === 'number', 'default longitude should be number')

const beijing = cityData.getLongitudeByCity('直辖市', '北京')
assert(beijing === 116.4, 'beijing longitude should match configured data')

const cityOptions = cityData.getCityOptionsByProvince('广东省')
assert(cityOptions.length > 0, 'province city options should not be empty')

console.log('Ziwei city longitude tests passed')
