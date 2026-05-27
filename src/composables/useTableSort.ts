import { ref, computed, type Ref, type ComputedRef } from 'vue'

export type SortField = 'zhName' | 'fieldName' | 'attrType' | ''
export type SortDir = 'asc' | 'desc'

export interface UseTableSortReturn<T extends Record<string, string>> {
  sortField: Ref<SortField>
  sortDir: Ref<SortDir>
  toggleSort: (field: SortField) => void
  sortedRows: ComputedRef<T[]>
}

export function useTableSort<T extends Record<string, string>>(
  rows: Ref<T[]> | ComputedRef<T[]>
): UseTableSortReturn<T> {
  const sortField = ref<SortField>('')
  const sortDir = ref<SortDir>('asc')

  function toggleSort(field: SortField): void {
    if (sortField.value === field) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDir.value = 'asc'
    }
  }

  const sortedRows = computed(() => {
    const f = sortField.value
    if (!f) return rows.value
    const dir = sortDir.value === 'asc' ? 1 : -1
    return [...rows.value].sort((a, b) =>
      a[f].localeCompare(b[f], 'zh-Hans') * dir
    )
  })

  return { sortField, sortDir, toggleSort, sortedRows }
}
