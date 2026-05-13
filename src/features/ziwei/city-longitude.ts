export type CityLongitudeMap = Record<string, Record<string, number>>

export const CITY_LONGITUDE_MAP: CityLongitudeMap = {
  直辖市: { 北京: 116.4, 天津: 117.2, 上海: 121.47, 重庆: 106.55 },
  河北省: { 石家庄: 114.52, 唐山: 118.2, 秦皇岛: 119.6, 保定: 115.47, 廊坊: 116.7 },
  山西省: { 太原: 112.55, 大同: 113.3, 运城: 111.0, 临汾: 111.52, 长治: 113.12 },
  内蒙古: { 呼和浩特: 111.67, 包头: 109.84, 赤峰: 118.96, 通辽: 122.27, 鄂尔多斯: 109.78 },
  辽宁省: { 沈阳: 123.43, 大连: 121.62, 鞍山: 123.0, 丹东: 124.38, 朝阳: 120.45 },
  吉林省: { 长春: 125.32, 吉林市: 126.55, 四平: 124.35, 延边州: 129.5, 白城: 122.83 },
  黑龙江省: { 哈尔滨: 126.63, 齐齐哈尔: 123.95, 牡丹江: 129.63, 佳木斯: 130.36, 大庆: 125.03 },
  江苏省: { 南京: 118.78, 苏州: 120.58, 无锡: 120.3, 徐州: 117.28, 扬州: 119.42 },
  浙江省: { 杭州: 120.15, 宁波: 121.55, 温州: 120.7, 金华: 119.65, 台州: 121.43 },
  安徽省: { 合肥: 117.27, 芜湖: 118.38, 蚌埠: 117.39, 安庆: 117.06, 黄山: 118.33 },
  福建省: { 福州: 119.3, 厦门: 118.08, 泉州: 118.67, 漳州: 117.65, 龙岩: 117.02 },
  江西省: { 南昌: 115.85, 九江: 115.97, 赣州: 114.93, 宜春: 114.38, 上饶: 117.94 },
  山东省: { 济南: 117.0, 青岛: 120.38, 烟台: 121.39, 潍坊: 119.1, 临沂: 118.35 },
  河南省: { 郑州: 113.62, 洛阳: 112.44, 开封: 114.31, 南阳: 112.53, 信阳: 114.08 },
  湖北省: { 武汉: 114.3, 襄阳: 112.12, 宜昌: 111.29, 荆州: 112.24, 黄冈: 114.87 },
  湖南省: { 长沙: 112.93, 株洲: 113.13, 湘潭: 112.94, 岳阳: 113.12, 常德: 111.69 },
  广东省: { 广州: 113.27, 深圳: 114.05, 珠海: 113.57, 佛山: 113.12, 东莞: 113.75 },
  广西: { 南宁: 108.37, 柳州: 109.42, 桂林: 110.29, 北海: 109.12, 玉林: 110.17 },
  海南省: { 海口: 110.35, 三亚: 109.51, 儋州: 109.58 },
  四川省: { 成都: 104.07, 绵阳: 104.73, 乐山: 103.77, 宜宾: 104.62, 南充: 106.08 },
  贵州省: { 贵阳: 106.63, 遵义: 106.92, 安顺: 105.95, 毕节: 105.28, 铜仁: 109.18 },
  云南省: { 昆明: 102.71, 曲靖: 103.79, 玉溪: 102.55, 大理州: 100.23, 丽江: 100.23 },
  西藏: { 拉萨: 91.13, 日喀则: 88.88, 林芝: 94.36, 昌都: 97.17 },
  陕西省: { 西安: 108.94, 宝鸡: 107.15, 咸阳: 108.71, 渭南: 109.47, 榆林: 109.74 },
  甘肃省: { 兰州: 103.84, 天水: 105.72, 武威: 102.64, 酒泉: 98.52, 张掖: 100.45 },
  青海省: { 西宁: 101.78, 海东: 102.1, 玉树州: 97.01, 海西州: 97.37 },
  宁夏: { 银川: 106.23, 石嘴山: 106.38, 吴忠: 106.19, 中卫: 105.19 },
  新疆: { 乌鲁木齐: 87.62, 喀什: 75.99, 和田: 79.93, 伊犁州: 81.33, 阿勒泰: 88.13 },
  港澳台: { 香港: 114.17, 澳门: 113.55, 台北: 121.56, 台中: 120.67, 高雄: 120.3, 台南: 120.22 }
}

export interface FormOption {
  value: string
  label: string
}

function compareLabel(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN')
}

export const PROVINCE_OPTIONS: FormOption[] = Object.keys(CITY_LONGITUDE_MAP)
  .sort(compareLabel)
  .map((name) => ({ value: name, label: name }))

export function getCityOptionsByProvince(province: string): FormOption[] {
  const cityMap = CITY_LONGITUDE_MAP[province]
  if (!cityMap) return []
  return Object.keys(cityMap)
    .sort(compareLabel)
    .map((name) => ({ value: name, label: name }))
}

export function getLongitudeByCity(province: string, city: string): number | null {
  const cityMap = CITY_LONGITUDE_MAP[province]
  if (!cityMap) return null
  const value = cityMap[city]
  return typeof value === 'number' ? value : null
}

export function getDefaultProvinceCity(): { province: string; city: string; longitude: number } {
  const province = PROVINCE_OPTIONS[0]?.value || '直辖市'
  const firstCity = Object.keys(CITY_LONGITUDE_MAP[province] || {})[0] || '北京'
  const longitude = getLongitudeByCity(province, firstCity) ?? 120
  return { province, city: firstCity, longitude }
}
