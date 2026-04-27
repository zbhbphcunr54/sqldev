import { buildZiweiShareLink, createZiweiSharePosterSpec } from './share'

declare global {
  interface Window {
    SQLDEV_ZIWEI_SHARE_UTILS?: {
      buildZiweiShareLink: typeof buildZiweiShareLink
      createZiweiSharePosterSpec: typeof createZiweiSharePosterSpec
    }
  }
}

window.SQLDEV_ZIWEI_SHARE_UTILS = Object.freeze({
  buildZiweiShareLink,
  createZiweiSharePosterSpec
})
