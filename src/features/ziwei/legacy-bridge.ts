import {
  buildZiweiAiPayload,
  buildZiweiAiPayloadCompact,
  buildZiweiAiPayloadLegacyCompact,
  buildZiweiAiPayloadLite,
  isZiweiAiRateLimitError,
  isZiweiComputeResourceError,
  mapZiweiAiErrorMessage,
  parseZiweiInvokeError,
  trimZiweiText
} from './ai-utils'

declare global {
  interface Window {
    SQLDEV_ZIWEI_AI_UTILS?: {
      buildZiweiAiPayload: typeof buildZiweiAiPayload
      buildZiweiAiPayloadCompact: typeof buildZiweiAiPayloadCompact
      buildZiweiAiPayloadLegacyCompact: typeof buildZiweiAiPayloadLegacyCompact
      buildZiweiAiPayloadLite: typeof buildZiweiAiPayloadLite
      isZiweiAiRateLimitError: typeof isZiweiAiRateLimitError
      isZiweiComputeResourceError: typeof isZiweiComputeResourceError
      mapZiweiAiErrorMessage: typeof mapZiweiAiErrorMessage
      parseZiweiInvokeError: typeof parseZiweiInvokeError
      trimZiweiText: typeof trimZiweiText
    }
  }
}

window.SQLDEV_ZIWEI_AI_UTILS = Object.freeze({
  buildZiweiAiPayload,
  buildZiweiAiPayloadCompact,
  buildZiweiAiPayloadLegacyCompact,
  buildZiweiAiPayloadLite,
  isZiweiAiRateLimitError,
  isZiweiComputeResourceError,
  mapZiweiAiErrorMessage,
  parseZiweiInvokeError,
  trimZiweiText
})
