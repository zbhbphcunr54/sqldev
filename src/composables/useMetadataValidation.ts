import { reactive } from 'vue'
import type { MetadataRecord } from '@/stores/metadata'

interface ValidationContext {
  allRecords: MetadataRecord[]
  currentRecordId: string
}

export function useMetadataValidation() {
  const fieldErrors = reactive(new Map<string, Map<string, string>>())

  function isValidVersion(v: string): boolean {
    return /^[vV]\d+\.\d+\.\d+$/.test(v.trim())
  }

  function validateField(
    recordId: string,
    field: string,
    value: string,
    ctx?: ValidationContext
  ): void {
    let errors = fieldErrors.get(recordId)
    if (!errors) {
      errors = new Map()
      fieldErrors.set(recordId, errors)
    }

    const v = value.trim()

    if (field === 'zhName') {
      if (!v) errors.set(field, '必填')
      else if (!/[一-鿿]/.test(v)) errors.set(field, '请输入中文')
      else errors.delete(field)
    } else if (field === 'fieldName') {
      if (!v) errors.set(field, '必填')
      else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) errors.set(field, '请输入英文标识符')
      else if (
        ctx &&
        ctx.allRecords.some(
          (r) => r.id !== ctx.currentRecordId && r.fieldName.trim().toLowerCase() === v.toLowerCase()
        )
      ) errors.set(field, '字段名已存在')
      else errors.delete(field)
    } else if (field === 'attrType') {
      if (!v) errors.set(field, '必填')
      else errors.delete(field)
    }
  }

  function getFieldError(recordId: string, field: string): string {
    return fieldErrors.get(recordId)?.get(field) ?? ''
  }

  function validateRecord(record: MetadataRecord, allRecords?: MetadataRecord[]): boolean {
    const ctx = allRecords ? { allRecords, currentRecordId: record.id } : undefined
    validateField(record.id, 'zhName', record.zhName, ctx)
    validateField(record.id, 'fieldName', record.fieldName, ctx)
    validateField(record.id, 'attrType', record.attrType, ctx)
    const errors = fieldErrors.get(record.id)
    return !errors || errors.size === 0
  }

  return { fieldErrors, isValidVersion, validateField, getFieldError, validateRecord }
}
