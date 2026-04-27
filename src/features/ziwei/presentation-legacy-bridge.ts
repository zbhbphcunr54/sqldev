import {
  formatZiweiDurationText,
  formatZiweiHistoryTime,
  isLikelyMojibakeZh,
  normalizeZiweiQaSuggestionText
} from './presentation'

declare global {
  interface Window {
    SQLDEV_ZIWEI_PRESENTATION_UTILS?: {
      formatZiweiDurationText: typeof formatZiweiDurationText
      formatZiweiHistoryTime: typeof formatZiweiHistoryTime
      isLikelyMojibakeZh: typeof isLikelyMojibakeZh
      normalizeZiweiQaSuggestionText: typeof normalizeZiweiQaSuggestionText
    }
  }
}

window.SQLDEV_ZIWEI_PRESENTATION_UTILS = Object.freeze({
  formatZiweiDurationText,
  formatZiweiHistoryTime,
  isLikelyMojibakeZh,
  normalizeZiweiQaSuggestionText
})
