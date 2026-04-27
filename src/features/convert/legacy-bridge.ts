import { mapConvertErrorMessage } from './error-map'

declare global {
  interface Window {
    SQLDEV_CONVERT_UTILS?: {
      mapConvertErrorMessage: typeof mapConvertErrorMessage
    }
  }
}

window.SQLDEV_CONVERT_UTILS = Object.freeze({
  mapConvertErrorMessage
})
