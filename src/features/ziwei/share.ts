export interface ZiweiShareLocationLike {
  origin?: unknown
  pathname?: unknown
}

export interface ZiweiPosterFeatureCard {
  title: string
  desc: string
  color: string
}

export interface ZiweiPosterMetric {
  value: string
  label: string
}

export interface ZiweiPosterKeyword {
  label: string
  tone: 'gold' | 'teal' | 'coral' | 'blue'
}

export interface ZiweiPosterPalacePreview {
  name: string
  summary: string
  stars: string[]
  tone: 'gold' | 'teal' | 'coral'
}

export interface ZiweiSharePosterSpec {
  posterWidth: number
  posterHeight: number
  gridStep: number
  eyebrow: string
  title: string
  subtitle: string
  insightHeadline: string
  insightBody: string
  shareEntryTitle: string
  shareEntryDescription: string
  footerTitle: string
  footerSubtitle: string
  shareLink: string
  shareLinkDisplay: string
  heroMetrics: ZiweiPosterMetric[]
  keywords: ZiweiPosterKeyword[]
  palacePreview: ZiweiPosterPalacePreview[]
  featureCards: ZiweiPosterFeatureCard[]
  backgroundStops: Array<{ offset: number; color: string }>
  glows: Array<{ x: number; y: number; radius: number; color: string }>
}

const ZIWEI_POSTER_COLORS = {
  featureBlue: '#7aa8ff',
  featureCyan: '#7ce7d8',
  featureGold: '#fcbf74',
  featurePurple: '#c69cff',
  backgroundTop: '#060d1f',
  backgroundMiddle: '#0b1531',
  backgroundBottom: '#111f44',
  glowBlue: 'rgba(79,125,249,.32)',
  glowCyan: 'rgba(95,180,255,.2)',
  glowPurple: 'rgba(139,92,246,.24)'
} as const

const SHARE_LINK_DISPLAY_MAX_LENGTH = 74

export function buildZiweiShareLink(
  locationLike: ZiweiShareLocationLike | null | undefined
): string {
  if (!locationLike) return ''
  const origin = String(locationLike.origin || '')
  const pathname = String(locationLike.pathname || '/')
  return `${origin}${pathname}?ziwei_share=1#/workbench/ziwei`
}

export function createZiweiSharePosterSpec(shareLinkValue: unknown): ZiweiSharePosterSpec {
  const shareLink = String(shareLinkValue || '')
  const shareLinkDisplay =
    shareLink.length > SHARE_LINK_DISPLAY_MAX_LENGTH
      ? `${shareLink.slice(0, SHARE_LINK_DISPLAY_MAX_LENGTH)}...`
      : shareLink

  return {
    posterWidth: 1200,
    posterHeight: 1880,
    gridStep: 36,
    eyebrow: 'ZIWEI DOSSIER',
    title: '把命盘做成一张会被转发的封面',
    subtitle: '真太阳时校正 · 三层四化 · AI 深度解读 · 连续追问',
    insightHeadline: '不是一句“运势如何”，而是把你的主线、关系、转折点一次摊开。',
    insightBody: '用更有封面感的呈现，让紫微斗数从工具页变成值得截图、愿意转发的内容物。',
    shareEntryTitle: '体验入口',
    shareEntryDescription: '扫码即可进入紫微页面，直接排盘、看解读、继续追问，不需要额外下载。',
    footerTitle: 'SQLDev × 紫微斗数',
    footerSubtitle: 'AI Powered Professional Charting Platform',
    shareLink,
    shareLinkDisplay,
    heroMetrics: [
      { value: '12 宫', label: '主线同屏展开' },
      { value: '3 层', label: '生年 / 大限 / 流年四化' },
      { value: 'AI', label: '可继续追问解盘' }
    ],
    keywords: [
      { label: '命盘主线', tone: 'gold' },
      { label: '关系节奏', tone: 'coral' },
      { label: '事业转折', tone: 'blue' },
      { label: 'AI 追问', tone: 'teal' }
    ],
    palacePreview: [
      {
        name: '命宫',
        summary: '格局与气场',
        stars: ['紫微', '天府'],
        tone: 'gold'
      },
      {
        name: '财帛',
        summary: '赚钱方式',
        stars: ['武曲', '天相'],
        tone: 'teal'
      },
      {
        name: '官禄',
        summary: '事业表达',
        stars: ['廉贞', '破军'],
        tone: 'coral'
      }
    ],
    featureCards: [
      {
        title: '完整命盘展开',
        desc: '主星、辅星、杂曜、四化与宫位结构一次看全。',
        color: ZIWEI_POSTER_COLORS.featureBlue
      },
      {
        title: 'AI 深度解盘',
        desc: '围绕命盘结构给出重点，不是模板式的泛泛而谈。',
        color: ZIWEI_POSTER_COLORS.featureCyan
      },
      {
        title: '连续追问问答',
        desc: '感情、事业、财富等具体议题都可以继续向下追问。',
        color: ZIWEI_POSTER_COLORS.featureGold
      },
      {
        title: '一键分享入口',
        desc: '分享链接直达紫微页，把体验从封面一路带进内容。',
        color: ZIWEI_POSTER_COLORS.featurePurple
      }
    ],
    backgroundStops: [
      { offset: 0, color: ZIWEI_POSTER_COLORS.backgroundTop },
      { offset: 0.52, color: ZIWEI_POSTER_COLORS.backgroundMiddle },
      { offset: 1, color: ZIWEI_POSTER_COLORS.backgroundBottom }
    ],
    glows: [
      { x: 190, y: 240, radius: 320, color: ZIWEI_POSTER_COLORS.glowBlue },
      { x: 1020, y: 360, radius: 360, color: ZIWEI_POSTER_COLORS.glowCyan },
      { x: 640, y: 1520, radius: 420, color: ZIWEI_POSTER_COLORS.glowPurple }
    ]
  }
}
