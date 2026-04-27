import { copyTextToClipboard, downloadSqlTextFile } from './file-actions'

declare global {
  interface Window {
    SQLDEV_BROWSER_UTILS?: {
      copyTextToClipboard: typeof copyTextToClipboard
      downloadSqlTextFile: typeof downloadSqlTextFile
    }
  }
}

window.SQLDEV_BROWSER_UTILS = Object.freeze({
  copyTextToClipboard,
  downloadSqlTextFile
})
