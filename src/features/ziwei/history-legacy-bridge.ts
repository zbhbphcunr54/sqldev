import {
  buildZiweiHistoryLabel,
  createZiweiHistoryRecord,
  loadZiweiHistoryRecords,
  saveZiweiHistoryRecords
} from './history'

declare global {
  interface Window {
    SQLDEV_ZIWEI_HISTORY_UTILS?: {
      buildZiweiHistoryLabel: typeof buildZiweiHistoryLabel
      createZiweiHistoryRecord: typeof createZiweiHistoryRecord
      loadZiweiHistoryRecords: typeof loadZiweiHistoryRecords
      saveZiweiHistoryRecords: typeof saveZiweiHistoryRecords
    }
  }
}

window.SQLDEV_ZIWEI_HISTORY_UTILS = Object.freeze({
  buildZiweiHistoryLabel,
  createZiweiHistoryRecord,
  loadZiweiHistoryRecords,
  saveZiweiHistoryRecords
})
