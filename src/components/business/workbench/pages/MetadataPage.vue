<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import FormSelect from '@/components/common/FormSelect.vue'
import Icon from '@/components/common/Icon.vue'
import { useAuthStore } from '@/stores/auth'
import { useEscapeKey } from '@/composables/useEscapeKey'
import { useMetadataValidation } from '@/composables/useMetadataValidation'
import { useConnectorLines } from '@/composables/useConnectorLines'
import {
  useWorkbenchStore,
  type MetadataRecord,
  type MetadataRevisionInfo
} from '@/stores/workbench'
import { exportMetadataAsCsv, exportMetadataAsJson } from '@/features/metadata/export'

const store = useWorkbenchStore()
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const attrTypeOptions = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'boolean', label: '布尔' },
  { value: 'enum', label: '枚举' },
  { value: 'json', label: 'JSON' }
]

const rows = computed(() => store.metadataRecords)
const revisions = computed(() => store.metadataRevisions)
const currentAuthor = computed(() => user.value?.email ?? user.value?.id ?? '当前用户')
const searchQuery = ref('')
const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) =>
      r.zhName.toLowerCase().includes(q) ||
      r.fieldName.toLowerCase().includes(q) ||
      r.attrType.toLowerCase().includes(q)
  )
})
const highlightedRecordId = ref<string | null>(null)
const expandedRecordId = ref<string | null>(null)
const expandedRecord = computed(
  () => rows.value.find((record) => record.id === expandedRecordId.value) ?? null
)

// --- Revision modal state (new + edit) ---
const revisionModalOpen = ref(false)
const revisionModalRecordId = ref<string | null>(null)
const revisionEditId = ref<string | null>(null)
const revisionVersion = ref('')
const revisionNote = ref('')
const revisionCanConfirm = computed(
  () =>
    revisionVersion.value.trim() !== '' &&
    revisionNote.value.trim() !== '' &&
    isValidVersion(revisionVersion.value)
)
const isRevisionEdit = computed(() => revisionEditId.value !== null)

// --- Popover for long notes ---
const popoverRevisionId = ref<string | null>(null)

// --- Validation ---
const { isValidVersion, validateField, getFieldError, validateRecord } =
  useMetadataValidation()

// --- Delete modal state ---
const deleteModalOpen = ref(false)
const deleteModalRecordId = ref<string | null>(null)
const deleteVersion = ref('')
const deleteNote = ref('')
const deleteCanConfirm = computed(
  () =>
    deleteVersion.value.trim() !== '' &&
    deleteNote.value.trim() !== '' &&
    isValidVersion(deleteVersion.value)
)

// --- Performance: pre-indexed revision map ---
const revisionsByRecord = computed(() => {
  const map = new Map<string, MetadataRevisionInfo[]>()
  for (const rev of revisions.value) {
    const arr = map.get(rev.recordId)
    if (arr) arr.push(rev)
    else map.set(rev.recordId, [rev])
  }
  return map
})

// --- SVG connector line refs ---
const workspaceRef = ref<HTMLElement | null>(null)
const tableScrollRef = ref<HTMLElement | null>(null)
const tablePanelRef = ref<HTMLElement | null>(null)
const revisionContentRef = ref<HTMLElement | null>(null)

const { svgLines, bezierPath } = useConnectorLines(
  workspaceRef,
  tablePanelRef,
  tableScrollRef,
  revisionContentRef,
  rows,
  revisions
)

watch(
  () => store.metadataRecords,
  () => store.ensureMetadataRevisions(),
  { deep: true }
)

function updateRecord(
  recordId: string,
  field: keyof Omit<MetadataRecord, 'id'>,
  event: Event
): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
  store.updateMetadataRecord(recordId, field, target.value)
  validateField(recordId, field, target.value)
}

function updateRecordSelect(
  recordId: string,
  field: keyof Omit<MetadataRecord, 'id'>,
  value: string
): void {
  store.updateMetadataRecord(recordId, field, value)
  validateField(recordId, field, value)
}

function incrementVersion(version: string): string {
  const match = /^([vV])(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return 'v1.0.0'
  return `${match[1]}${match[2]}.${match[3]}.${Number(match[4]) + 1}`
}

function openRevisionModal(recordId: string): void {
  const record = rows.value.find((r) => r.id === recordId)
  if (!record || !validateRecord(record)) {
    store.showAlert('校验未通过', '请先完成必填字段：中文名称（中文）、字段名称（英文）、属性类型。')
    return
  }
  revisionModalRecordId.value = recordId
  revisionEditId.value = null
  const recordRevisions = revisionsByRecord.value.get(recordId) ?? []
  const lastVersion =
    recordRevisions.length > 0 ? recordRevisions[recordRevisions.length - 1].version : ''
  revisionVersion.value = lastVersion ? incrementVersion(lastVersion) : 'v1.0.0'
  revisionNote.value = ''
  revisionModalOpen.value = true
}

function openRevisionEdit(revision: MetadataRevisionInfo): void {
  revisionModalRecordId.value = revision.recordId
  revisionEditId.value = revision.id
  revisionVersion.value = revision.version
  revisionNote.value = revision.revisionNote
  revisionModalOpen.value = true
}

function closeRevisionModal(): void {
  revisionModalOpen.value = false
  revisionModalRecordId.value = null
  revisionEditId.value = null
  revisionVersion.value = ''
  revisionNote.value = ''
}

function confirmRevisionAndSave(): void {
  if (!revisionCanConfirm.value) return

  if (revisionEditId.value) {
    store.updateMetadataRevision(revisionEditId.value, 'version', revisionVersion.value.trim())
    store.updateMetadataRevision(revisionEditId.value, 'revisionNote', revisionNote.value.trim())
    closeRevisionModal()
    store.showAlert('修改成功', '修订信息已更新。')
  } else if (revisionModalRecordId.value) {
    store.saveMetadataWorkspace()
    store.addMetadataRevision(
      revisionModalRecordId.value,
      currentAuthor.value,
      revisionVersion.value.trim(),
      revisionNote.value.trim()
    )
    closeRevisionModal()
    store.showAlert('保存成功', '元数据记录已保存。')
  }
}

function openBusinessDesc(recordId: string): void {
  expandedRecordId.value = recordId
}

function closeBusinessDesc(): void {
  expandedRecordId.value = null
}

useEscapeKey(() => {
  if (deleteModalOpen.value) closeDeleteModal()
  else if (revisionModalOpen.value) closeRevisionModal()
  else if (popoverRevisionId.value) popoverRevisionId.value = null
  else if (expandedRecordId.value) closeBusinessDesc()
})

function getRecordRevisions(recordId: string): MetadataRevisionInfo[] {
  return revisionsByRecord.value.get(recordId) ?? []
}

function togglePopover(id: string): void {
  popoverRevisionId.value = popoverRevisionId.value === id ? null : id
}

function isNoteLong(text: string, maxLen = 20): boolean {
  return !!text && text.length > maxLen
}

function truncate(text: string, maxLen = 14): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function toggleHighlight(recordId: string): void {
  highlightedRecordId.value = highlightedRecordId.value === recordId ? null : recordId
}

function handleDeleteRecord(recordId: string): void {
  deleteModalRecordId.value = recordId
  deleteVersion.value = ''
  deleteNote.value = ''
  deleteModalOpen.value = true
}

function closeDeleteModal(): void {
  deleteModalOpen.value = false
  deleteModalRecordId.value = null
  deleteVersion.value = ''
  deleteNote.value = ''
}

function confirmDelete(): void {
  if (!deleteCanConfirm.value || !deleteModalRecordId.value) return
  store.deleteMetadataRecord(
    deleteModalRecordId.value,
    currentAuthor.value,
    deleteVersion.value.trim(),
    deleteNote.value.trim()
  )
  closeDeleteModal()
  store.showAlert('删除成功', '记录已删除，修订信息已归档至相邻记录。')
}

async function handleReset(): Promise<void> {
  const confirmed = await store.showConfirm(
    '重置元数据',
    '确认清空当前元数据记录与修订信息并恢复初始状态？'
  )
  if (!confirmed) return
  store.resetMetadataWorkspace(currentAuthor.value)
}

function handleExportCsv(): void {
  if (!exportMetadataAsCsv(rows.value)) {
    store.showAlert('导出失败', '没有可导出的记录。')
  }
}

function handleExportJson(): void {
  if (!exportMetadataAsJson(rows.value, revisions.value)) {
    store.showAlert('导出失败', '没有可导出的记录。')
  }
}
</script>

<template>
  <div class="md-page">
    <div class="md-top-bar">
      <h1 class="md-title">元数据</h1>
      <p class="md-subtitle">字段元数据维护与修订信息管理</p>
    </div>

    <div class="md-toolbar">
      <div class="md-toolbar-left">
        <button
          class="btn btn-primary md-btn-primary"
          type="button"
          @click="store.addMetadataRecord(currentAuthor)"
        >
          <Icon name="plus" :size="14" />
          <span>新增记录</span>
        </button>
        <div class="md-search-wrap">
          <Icon name="search" :size="14" class="md-search-icon" />
          <input
            v-model="searchQuery"
            class="md-search-input"
            type="text"
            placeholder="搜索字段..."
          />
        </div>
      </div>

      <div class="md-toolbar-right">
        <button class="btn md-btn-outline" type="button" @click="handleExportCsv">
          <Icon name="download" :size="14" />
          <span>导出 CSV</span>
        </button>
        <button class="btn md-btn-outline" type="button" @click="handleExportJson">
          <Icon name="download" :size="14" />
          <span>导出 JSON</span>
        </button>
        <button class="btn btn-primary md-btn-secondary" type="button" @click="handleReset">
          <Icon name="refresh" :size="14" />
          <span>重置</span>
        </button>
      </div>
    </div>

    <div ref="workspaceRef" class="md-workspace">
      <svg class="md-svg-overlay" aria-hidden="true">
        <path
          v-for="line in svgLines"
          :key="line.id"
          :d="bezierPath(line.x1, line.y1, line.x2, line.y2)"
          class="md-connector-path"
          :class="{ 'md-connector-highlight': highlightedRecordId === line.recordId }"
        />
      </svg>

      <section ref="tablePanelRef" class="md-panel md-record-panel">
        <div class="md-panel-header">
          <div class="md-panel-title">元数据表格</div>
        </div>

        <div class="md-panel-content">
          <div ref="tableScrollRef" class="md-table-scroll">
            <table class="md-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>中文名称</th>
                  <th>字段名称</th>
                  <th>属性类型</th>
                  <th>长度</th>
                  <th>标准代码</th>
                  <th>业务说明</th>
                  <th class="md-action-col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(record, idx) in filteredRows"
                  :key="record.id"
                  :data-record-id="record.id"
                  class="md-record-row"
                  :class="{ 'md-row-highlight': highlightedRecordId === record.id }"
                  @click="toggleHighlight(record.id)"
                >
                  <td>
                    <span class="md-order-label">{{ record.order }}</span>
                  </td>
                  <td>
                    <div class="md-validated-cell">
                      <input
                        :value="record.zhName"
                        class="md-input md-input-center md-input-inline"
                        :class="{ 'md-input-error': getFieldError(record.id, 'zhName') }"
                        type="text"
                        placeholder="客户名称"
                        @input="updateRecord(record.id, 'zhName', $event)"
                      />
                      <span v-if="getFieldError(record.id, 'zhName')" class="md-field-error">{{
                        getFieldError(record.id, 'zhName')
                      }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="md-validated-cell">
                      <input
                        :value="record.fieldName"
                        class="md-input md-input-center md-input-inline"
                        :class="{ 'md-input-error': getFieldError(record.id, 'fieldName') }"
                        type="text"
                        placeholder="customer_name"
                        @input="updateRecord(record.id, 'fieldName', $event)"
                      />
                      <span
                        v-if="getFieldError(record.id, 'fieldName')"
                        class="md-field-error"
                        >{{ getFieldError(record.id, 'fieldName') }}</span
                      >
                    </div>
                  </td>
                  <td :class="{ 'md-select-error': getFieldError(record.id, 'attrType') }">
                    <div class="md-validated-cell">
                      <FormSelect
                        :model-value="record.attrType"
                        :options="attrTypeOptions"
                        placeholder="选择类型"
                        compact
                        @update:model-value="
                          (value: string) => updateRecordSelect(record.id, 'attrType', value)
                        "
                      />
                      <span
                        v-if="getFieldError(record.id, 'attrType')"
                        class="md-field-error"
                        >{{ getFieldError(record.id, 'attrType') }}</span
                      >
                    </div>
                  </td>
                  <td>
                    <input
                      :value="record.length"
                      class="md-input md-input-center md-input-inline"
                      type="text"
                      inputmode="numeric"
                      placeholder="64"
                      @input="updateRecord(record.id, 'length', $event)"
                    />
                  </td>
                  <td>
                    <input
                      :value="record.standardCode"
                      class="md-input md-input-center md-input-inline"
                      type="text"
                      placeholder="STD_001"
                      @input="updateRecord(record.id, 'standardCode', $event)"
                    />
                  </td>
                  <td>
                    <div class="md-desc-wrap">
                      <textarea
                        :value="record.businessDesc"
                        class="md-textarea md-textarea-inline"
                        rows="1"
                        placeholder="字段业务含义与使用约束"
                        @input="updateRecord(record.id, 'businessDesc', $event)"
                      ></textarea>
                      <button
                        class="md-expand-btn"
                        type="button"
                        title="展开查看"
                        aria-label="展开查看"
                        @click="openBusinessDesc(record.id)"
                      >
                        <Icon name="external-link" :size="14" />
                      </button>
                    </div>
                  </td>
                  <td class="md-action-col">
                    <div class="md-action-inner">
                      <button
                        class="md-icon-btn"
                        type="button"
                        title="上移"
                        aria-label="上移"
                        :disabled="idx === 0"
                        @click.stop="store.moveMetadataRecord(record.id, 'up')"
                      >
                        <Icon name="chevron-up" :size="14" />
                      </button>
                      <button
                        class="md-icon-btn"
                        type="button"
                        title="下移"
                        aria-label="下移"
                        :disabled="idx === filteredRows.length - 1"
                        @click.stop="store.moveMetadataRecord(record.id, 'down')"
                      >
                        <Icon name="chevron-down" :size="14" />
                      </button>
                      <button
                        class="md-icon-btn success"
                        type="button"
                        title="保存记录"
                        aria-label="保存记录"
                        @click.stop="openRevisionModal(record.id)"
                      >
                        <Icon name="check" :size="15" />
                      </button>
                      <button
                        class="md-icon-btn danger"
                        type="button"
                        title="删除记录"
                        aria-label="删除记录"
                        @click.stop="handleDeleteRecord(record.id)"
                      >
                        <Icon name="trash" :size="15" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredRows.length === 0">
                  <td colspan="8" class="md-empty-state">
                    <template v-if="searchQuery.trim()">无匹配结果</template>
                    <template v-else>暂无记录，点击上方「新增记录」开始</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside class="md-panel md-revision-panel">
        <div class="md-panel-header">
          <div class="md-panel-title">修订信息</div>
        </div>

        <div ref="revisionContentRef" class="md-panel-content md-revision-content">
          <div v-for="record in filteredRows" :key="record.id" class="md-revision-group">
            <div class="md-revision-head">
              <div class="md-revision-title">
                {{ record.order }} - {{ record.zhName || record.fieldName || '未命名' }}
              </div>
            </div>

            <div class="md-revision-tags">
              <template v-if="getRecordRevisions(record.id).length > 0">
                  <div
                    v-for="revision in getRecordRevisions(record.id)"
                    :key="revision.id"
                    class="md-tag-wrapper"
                  >
                  <div
                    :data-revision-id="revision.id"
                    class="md-revision-tag"
                    :class="{ 'md-tag-highlight': highlightedRecordId === record.id }"
                    @click.stop="toggleHighlight(record.id)"
                  >
                    <span class="md-tag-date">{{ revision.revisionDate }}</span>
                    <span class="md-tag-sep">·</span>
                    <span class="md-tag-author">{{ revision.author || currentAuthor }}</span>
                    <span class="md-tag-sep">·</span>
                    <span class="md-tag-version">{{ revision.version }}</span>
                    <template v-if="revision.revisionNote">
                      <span class="md-tag-sep">·</span>
                      <span class="md-tag-note">{{ truncate(revision.revisionNote) }}</span>
                    </template>
                    <button
                      v-if="isNoteLong(revision.revisionNote)"
                      class="md-tag-action"
                      type="button"
                      :title="popoverRevisionId === revision.id ? '收起' : '展开'"
                      :aria-label="
                        popoverRevisionId === revision.id ? '收起修订说明' : '展开修订说明'
                      "
                      @click.stop="togglePopover(revision.id)"
                    >
                      <Icon
                        :name="popoverRevisionId === revision.id ? 'chevron-up' : 'chevron-down'"
                        :size="11"
                      />
                    </button>
                    <button
                      class="md-tag-action"
                      type="button"
                      title="编辑修订"
                      aria-label="编辑修订"
                      @click.stop="openRevisionEdit(revision)"
                    >
                      <Icon name="edit" :size="11" />
                    </button>
                  </div>
                  <div v-if="popoverRevisionId === revision.id" class="md-tag-detail" @click.stop>
                    <span class="md-tag-detail-meta"
                      >{{ revision.revisionDate }} · {{ revision.author || currentAuthor }} ·
                      {{ revision.version }}</span
                    >
                    <p class="md-tag-detail-note">{{ revision.revisionNote }}</p>
                  </div>
                </div>
              </template>
              <div v-else class="md-revision-empty">暂无修订</div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Business description expanded modal -->
    <div v-if="expandedRecord" class="md-desc-overlay" @click.self="closeBusinessDesc">
      <section class="md-desc-dialog" role="dialog" aria-modal="true" aria-label="业务说明">
        <header class="md-desc-dialog-header">
          <div>
            <h2>业务说明</h2>
            <p>
              {{
                expandedRecord.zhName || expandedRecord.fieldName || `记录 ${expandedRecord.order}`
              }}
            </p>
          </div>
          <button
            class="md-icon-btn"
            type="button"
            title="关闭"
            aria-label="关闭"
            @click="closeBusinessDesc"
          >
            <Icon name="x" :size="16" />
          </button>
        </header>
        <textarea
          :value="expandedRecord.businessDesc"
          class="md-textarea md-desc-dialog-textarea"
          rows="10"
          placeholder="字段业务含义与使用约束"
          @input="updateRecord(expandedRecord.id, 'businessDesc', $event)"
        ></textarea>
      </section>
    </div>

    <!-- Revision modal for gated save -->
    <div v-if="revisionModalOpen" class="md-desc-overlay" @click.self="closeRevisionModal">
      <section class="md-revision-modal" role="dialog" aria-modal="true" aria-label="填写修订信息">
        <header class="md-revision-modal-header">
          <div>
            <h2>{{ isRevisionEdit ? '编辑修订信息' : '填写修订信息' }}</h2>
            <p>{{ isRevisionEdit ? '修改版本号与修订说明' : '保存前请填写版本号与修订说明' }}</p>
          </div>
          <button
            class="md-icon-btn"
            type="button"
            title="关闭"
            aria-label="关闭"
            @click="closeRevisionModal"
          >
            <Icon name="x" :size="16" />
          </button>
        </header>

        <div class="md-revision-modal-body">
          <div class="md-revision-modal-field">
            <label class="md-revision-modal-label">版本号</label>
            <input
              v-model="revisionVersion"
              class="md-input"
              :class="{
                'md-input-error':
                  revisionVersion.trim() !== '' && !isValidVersion(revisionVersion)
              }"
              type="text"
              placeholder="v1.0.0"
            />
            <span
              v-if="revisionVersion.trim() !== '' && !isValidVersion(revisionVersion)"
              class="md-field-error"
              >格式：v + 数字版本号，如 v1.0.0</span
            >
          </div>
          <div class="md-revision-modal-field">
            <label class="md-revision-modal-label">修订说明</label>
            <textarea
              v-model="revisionNote"
              class="md-textarea"
              rows="3"
              placeholder="记录本次修订范围、背景与影响"
            ></textarea>
          </div>
        </div>

        <footer class="md-revision-modal-footer">
          <button class="btn md-btn-cancel" type="button" @click="closeRevisionModal">取消</button>
          <button
            class="btn btn-primary md-btn-confirm"
            type="button"
            :disabled="!revisionCanConfirm"
            @click="confirmRevisionAndSave"
          >
            {{ isRevisionEdit ? '确认' : '保存' }}
          </button>
        </footer>
      </section>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="deleteModalOpen" class="md-desc-overlay" @click.self="closeDeleteModal">
      <section class="md-revision-modal" role="dialog" aria-modal="true" aria-label="确认删除记录">
        <header class="md-revision-modal-header">
          <div>
            <h2>删除记录</h2>
            <p>删除前请填写修订说明，已有标签将自动归档至相邻记录</p>
          </div>
          <button
            class="md-icon-btn"
            type="button"
            title="关闭"
            aria-label="关闭"
            @click="closeDeleteModal"
          >
            <Icon name="x" :size="16" />
          </button>
        </header>

        <div class="md-revision-modal-body">
          <div class="md-revision-modal-field">
            <label class="md-revision-modal-label">版本号</label>
            <input
              v-model="deleteVersion"
              class="md-input"
              :class="{
                'md-input-error': deleteVersion.trim() !== '' && !isValidVersion(deleteVersion)
              }"
              type="text"
              placeholder="v1.0.1"
            />
            <span
              v-if="deleteVersion.trim() !== '' && !isValidVersion(deleteVersion)"
              class="md-field-error"
              >格式：v + 数字版本号，如 v1.0.0</span
            >
          </div>
          <div class="md-revision-modal-field">
            <label class="md-revision-modal-label">修订说明</label>
            <textarea
              v-model="deleteNote"
              class="md-textarea"
              rows="3"
              placeholder="说明删除原因"
            ></textarea>
          </div>
        </div>

        <footer class="md-revision-modal-footer">
          <button class="btn md-btn-cancel" type="button" @click="closeDeleteModal">取消</button>
          <button
            class="btn btn-primary md-btn-confirm md-btn-confirm--danger"
            type="button"
            :disabled="!deleteCanConfirm"
            @click="confirmDelete"
          >
            确认删除
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.md-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 12px;
  background: var(--color-page-panel);
  color: var(--color-page-text);
  overflow: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.md-top-bar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 52px;
  padding: 0 24px;
  flex-shrink: 0;
}

.md-title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-page-text);
  margin: 0;
}

.md-subtitle {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  margin: 0;
}

.md-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
  background: var(--color-page-panel);
}

.md-toolbar-left,
.md-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.md-btn-primary,
.md-btn-secondary {
  height: 32px;
  padding: 0 12px;
  gap: 6px;
  border-radius: 6px;
}

.md-btn-secondary {
  color: var(--color-page-danger);
}

.md-btn-outline {
  height: 32px;
  padding: 0 12px;
  gap: 6px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--color-page-border);
  color: var(--color-page-text-subtle);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.md-btn-outline:hover {
  background: var(--color-page-elevated);
  color: var(--color-page-text);
  border-color: var(--color-page-brand);
}

.md-btn-secondary:hover:not(:disabled) {
  background: var(--color-danger-bg);
}

.md-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.md-search-icon {
  position: absolute;
  left: 10px;
  color: var(--color-page-text-muted);
  pointer-events: none;
}

.md-search-input {
  height: 32px;
  width: 180px;
  padding: 0 10px 0 30px;
  border: 1px solid var(--color-page-border);
  border-radius: 6px;
  background: var(--color-page-input);
  color: var(--color-page-text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.md-search-input::placeholder {
  color: var(--color-page-text-muted);
}

.md-search-input:focus {
  outline: none;
  border-color: var(--color-page-brand);
}

.md-workspace {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 0;
  overflow: hidden;
  min-height: 0;
}

.md-svg-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.md-connector-path {
  fill: none;
  stroke: var(--color-page-brand);
  stroke-width: 1;
  stroke-linecap: round;
  opacity: 0.25;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.md-connector-highlight {
  opacity: 1;
  stroke-width: 2;
}

.md-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-page-panel);
  overflow: hidden;
}

.md-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background: var(--color-page-panel);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.md-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-page-text);
}

.md-panel-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.md-table-scroll {
  min-height: 100%;
  overflow: auto;
}

.md-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.md-table th,
.md-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-page-border);
  vertical-align: middle;
}

.md-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 40px;
  background: var(--color-page-panel);
  color: var(--color-page-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.md-table th:nth-child(1),
.md-table td:nth-child(1) {
  width: 48px;
  padding: 8px 4px;
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--color-page-panel);
}

.md-table th:nth-child(1) {
  z-index: 3;
}

.md-table th:nth-child(4),
.md-table td:nth-child(4) {
  width: 110px;
}

.md-table th:nth-child(5),
.md-table td:nth-child(5) {
  width: 64px;
}

.md-table th:nth-child(6),
.md-table td:nth-child(6) {
  width: 100px;
}

.md-table th:nth-child(8),
.md-table td:nth-child(8) {
  width: 140px;
  position: sticky;
  right: 0;
  z-index: 1;
  background: var(--color-page-panel);
}

.md-table th:nth-child(8) {
  z-index: 3;
}

.md-input,
.md-textarea {
  width: 100%;
  border: 1px solid var(--color-page-border-subtle, var(--color-page-border));
  border-radius: var(--radius-sm);
  background: var(--color-page-input);
  color: var(--color-page-text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.4;
  box-sizing: border-box;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.md-input {
  height: 34px;
  padding: 0 10px;
}

.md-textarea {
  min-height: 34px;
  padding: 7px 10px;
  resize: none;
}

.md-input::placeholder,
.md-textarea::placeholder {
  color: var(--color-page-text-muted);
}

.md-input:focus,
.md-textarea:focus {
  outline: none;
  border-color: var(--color-page-brand);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.md-input-error {
  border-color: var(--color-page-danger);
}

.md-input-error:focus {
  border-color: var(--color-page-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-page-danger) 15%, transparent);
}

.md-select-error :deep(.form-select-trigger) {
  border-color: var(--color-page-danger);
}

.md-validated-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.md-field-error {
  font-size: 11px;
  line-height: 1.2;
  color: var(--color-page-danger);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.md-input-center {
  text-align: center;
}

.md-input-mono {
  font-family: var(--font-code);
}

.md-input-inline,
.md-textarea-inline {
  min-width: 0;
}

.md-table :deep(.form-select-trigger.compact) {
  background: var(--color-page-input);
  border-color: var(--color-page-border-subtle, var(--color-page-border));
  border-radius: var(--radius-sm);
  color: var(--color-page-text);
  font-size: var(--text-sm);
}

.md-table :deep(.trigger-label) {
  text-align: center;
}

.md-desc-wrap {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.md-expand-btn {
  flex: 0 0 auto;
  width: 32px;
  height: 34px;
  border: 1px solid var(--color-page-border-subtle, var(--color-page-border));
  border-radius: var(--radius-sm);
  background: var(--color-page-input);
  color: var(--color-page-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.md-expand-btn:hover {
  color: var(--color-page-text);
  background: var(--color-page-elevated);
}

.md-action-col {
  text-align: center;
}

.md-action-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.md-record-row {
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.md-order-label {
  display: block;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-page-text-muted);
  font-weight: 600;
  line-height: 34px;
}

.md-empty-state {
  text-align: center;
  padding: 40px 16px;
  color: var(--color-page-text-muted);
  font-size: var(--text-sm);
}

.md-row-highlight > td {
  background: color-mix(in srgb, var(--color-page-brand) 14%, var(--color-page-panel));
}

.md-row-highlight > td:first-child {
  box-shadow: inset 3px 0 0 var(--color-page-brand);
}

.md-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.md-icon-btn:hover {
  background: var(--color-page-elevated);
  color: var(--color-page-text);
}

.md-icon-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.md-icon-btn:disabled:hover {
  background: transparent;
  color: var(--color-page-text-subtle);
}

.md-icon-btn.danger {
  color: var(--color-page-danger);
}

.md-icon-btn.danger:hover {
  background: var(--color-danger-bg);
}

.md-icon-btn.success {
  color: var(--color-success);
}

.md-icon-btn.success:hover {
  background: var(--color-success-bg);
}

/* --- Revision panel --- */
.md-revision-panel {
  border-left: 1px solid var(--color-page-border);
}

.md-revision-content {
  padding: 16px 16px 16px 48px;
}

.md-revision-group + .md-revision-group {
  margin-top: 18px;
}

.md-revision-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.md-revision-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-page-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Revision tags --- */
.md-revision-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.md-tag-wrapper {
  display: flex;
  flex-direction: column;
}

.md-revision-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--color-page-border-subtle, var(--color-page-border));
  border-radius: var(--radius-pill);
  background: var(--color-page-elevated);
  font-size: var(--text-xs);
  color: var(--color-page-text-subtle);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.md-revision-tag:hover {
  border-color: var(--color-page-brand);
}

.md-tag-highlight {
  border-color: var(--color-page-brand);
  background: color-mix(in srgb, var(--color-page-brand) 18%, var(--color-page-elevated));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-page-brand) 30%, transparent);
}

.md-tag-sep {
  color: var(--color-page-text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}

.md-tag-date {
  color: var(--color-page-text-muted);
  font-size: var(--text-xs);
  flex-shrink: 0;
}

.md-tag-author {
  color: var(--color-page-text);
  font-weight: 500;
  flex-shrink: 0;
}

.md-tag-version {
  color: var(--color-page-brand);
  font-weight: 600;
  flex-shrink: 0;
}

.md-tag-note {
  color: var(--color-page-text-subtle);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.md-tag-detail {
  margin-top: 4px;
  padding: 6px 10px;
  border-left: 2px solid var(--color-page-brand);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: color-mix(in srgb, var(--color-page-brand) 5%, var(--color-page-elevated));
  animation: md-detail-in var(--duration-fast) var(--ease-out);
}

@keyframes md-detail-in {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 200px;
  }
}

.md-tag-detail-meta {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
}

.md-tag-detail-note {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--color-page-text);
  line-height: 1.55;
  word-break: break-all;
}

.md-tag-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-page-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.md-tag-action:hover {
  background: var(--color-page-elevated);
  color: var(--color-page-brand);
}

.md-revision-empty {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  padding: 4px 0;
}

/* --- Business desc overlay --- */
.md-desc-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-overlay) 80%, transparent);
}

.md-desc-dialog {
  width: min(680px, 100%);
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xl);
  padding: 16px;
}

.md-desc-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.md-desc-dialog-header h2 {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
}

.md-desc-dialog-header p {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
}

.md-desc-dialog-textarea {
  width: 100%;
  min-height: 320px;
  resize: vertical;
}

/* --- Revision modal --- */
.md-revision-modal {
  width: min(460px, 92vw);
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: md-modal-in var(--duration-normal) var(--ease-out);
}

@keyframes md-modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.md-revision-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-page-border-subtle, var(--color-page-border));
}

.md-revision-modal-header h2 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-page-text);
}

.md-revision-modal-header p {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
}

.md-revision-modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.md-revision-modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.md-revision-modal-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-page-text-subtle);
}

.md-revision-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-page-border-subtle, var(--color-page-border));
}

.md-btn-cancel {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--color-page-border);
  color: var(--color-page-text-subtle);
  transition: all var(--duration-fast) var(--ease-out);
}

.md-btn-cancel:hover {
  background: var(--color-page-elevated);
  color: var(--color-page-text);
}

.md-btn-confirm {
  height: 36px;
  padding: 0 20px;
  border-radius: var(--radius-md);
}

.md-btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.md-btn-confirm--danger {
  background: var(--color-page-danger);
  border-color: var(--color-page-danger);
}

.md-btn-confirm--danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

/* --- Responsive --- */
@media (max-width: 1279px) {
  .md-workspace {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .md-revision-panel {
    border-left: none;
    border-top: 1px solid var(--color-page-border);
  }

  .md-svg-overlay {
    display: none;
  }
}

@media (max-width: 767px) {
  .md-top-bar {
    padding: 0 16px;
  }

  .md-toolbar {
    padding: 10px 12px;
  }
}
</style>
