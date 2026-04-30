export interface ZiweiShareLocationLike {
  origin?: unknown
  pathname?: unknown
}

export interface ZiweiPosterFeatureCard {
  title: string
  desc: string
  color: string
}

export interface ZiweiSharePosterSpec {
  posterWidth: number
  posterHeight: number
  gridStep: number
  eyebrow: string
  title: string
  subtitle: string
  shareEntryTitle: string
  shareEntryDescription: string
  footerTitle: string
  footerSubtitle: string
  shareLink: string
  shareLinkDisplay: string
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
  const shareLinkDisplay = shareLink.length > 74 ? `${shareLink.slice(0, 74)}...` : shareLink

  return {
    posterWidth: 1200,
    posterHeight: 1880,
    gridStep: 36,
    eyebrow: 'Z I W E I  D O U  S H U',
    title: '紫微斗数命盘',
    subtitle: '专业排盘 + AI 深度解读 + 一键分享',
    shareEntryTitle: '体验入口',
    shareEntryDescription: '扫码或打开链接，即可进入命盘界面体验完整功能',
    footerTitle: 'SQLDev × 紫微斗数工具',
    footerSubtitle: 'AI Powered Professional Charting Platform',
    shareLink,
    shareLinkDisplay,
    featureCards: [
      {
        title: '完整命盘分析',
        desc: '支持主星/辅星/杂曜/四化、大限/流年/小限',
        color: ZIWEI_POSTER_COLORS.featureBlue
      },
      {
        title: 'AI 个性化解盘',
        desc: '一键生成专业结构化解读，并支持追问',
        color: ZIWEI_POSTER_COLORS.featureCyan
      },
      {
        title: '云端配置模板',
        desc: '解读模板、问答建议由服务端统一控制',
        color: ZIWEI_POSTER_COLORS.featureGold
      },
      {
        title: '分享友好体验',
        desc: '生成专属分享入口，访客可直达命盘界面',
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
