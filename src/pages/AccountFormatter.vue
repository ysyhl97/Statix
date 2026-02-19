<template>
  <div v-cloak>
    <div class="app-wrapper account-page">
      <TopNav>
        <template #center>
          <div class="search-container">
            <div class="hub-intro">
              <div class="hub-title">账号卡密格式化 V3</div>
              <div class="hub-sub">按字段排序映射：第1字段对应第1段分词</div>
            </div>
          </div>
        </template>
      </TopNav>

      <div class="account-layout account-layout--v2">
        <div class="pane-card account-input-card">
          <div class="account-input-sections">
            <div class="account-section-card account-section-card--input excel-settings-box">
              <div class="pane-title">输入内容</div>
              <el-input
                v-model="rawInput"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="每行一组账号卡密，优先按所选/输入分隔符解析"
                class="dialog-input account-input"
              />
              <div class="account-actions">
                <el-button class="account-btn account-btn--subtle" @click="clearAll">清空</el-button>
              </div>
            </div>

            <div class="account-section-card account-section-card--config excel-settings-box">
              <div class="pane-title">解析参数</div>
              <div class="account-settings-grid">
                <div class="excel-inline excel-inline--auto">
                  <span class="excel-inline-label">分隔符</span>
                  <el-input v-model="delimiterInput" placeholder="分隔符（可手动输入，例如 ----）" class="dialog-input mini-input" />
                </div>
                <div class="account-trim-panel">
                  <div class="account-trim-head">
                    <span class="excel-inline-label">字段前后缀过滤</span>
                    <el-switch v-model="trimEnabled" />
                  </div>
                  <div class="account-trim-grid">
                    <el-select v-model="trimEditorField" class="dialog-input mini-input">
                      <el-option v-for="opt in trimFieldOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                    <el-input
                      v-model="trimPrefixInput"
                      placeholder="前缀（逗号/换行分隔），默认 auth_token="
                      class="dialog-input mini-input"
                    />
                    <el-input
                      v-model="trimSuffixInput"
                      placeholder="后缀（逗号/换行分隔）"
                      class="dialog-input mini-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="sampleTokens.length"
              class="account-section-card account-section-card--mapping account-sample-mapper account-failed-item--fix excel-settings-box"
            >
              <div class="pane-title">字段排序映射</div>
              <div class="account-failed-head">
                <span class="pane-hint">拖拽字段排序，顺序即分词映射顺序</span>
                <span class="pane-hint">参与 {{ activeSortCount }} / 总 {{ orderedFieldItems.length }}</span>
              </div>

              <div class="account-option-add">
                <el-input v-model="newCustomFieldName" class="dialog-input mini-input" placeholder="新增字段名，例如 代理" />
                <el-button size="small" type="primary" class="account-btn account-btn--primary" @click="addCustomRole">新增字段</el-button>
                <el-button size="small" class="account-btn account-btn--subtle" @click="resetFieldOrder">恢复默认排序</el-button>
              </div>

              <div class="account-field-order-list">
                <div
                  v-for="(field, idx) in orderedFieldItems"
                  :key="`field_${field.key}`"
                  class="account-field-order-chip"
                  draggable="true"
                  :class="{ 'is-dragging': dragFieldKey === field.key, 'is-active': field.active, 'is-inactive': !field.active }"
                  @dragstart="onFieldDragStart($event, field.key)"
                  @dragend="onFieldDragEnd"
                  @dragover.prevent
                  @drop="onFieldDrop($event, field.key)"
                >
                  <span v-if="field.active" class="account-field-rank-badge">#{{ field.rank }}</span>
                  <span class="account-field-order-chip-handle">≡</span>
                  <span>{{ field.label }}</span>
                  <span v-if="!field.active" class="account-field-state-tag">未参与</span>
                  <span class="account-field-order-chip-actions">
                    <button
                      type="button"
                      class="account-field-order-chip-btn"
                      :disabled="idx === 0"
                      @click="moveFieldByDelta(field.key, -1)"
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      class="account-field-order-chip-btn"
                      :disabled="idx === orderedFieldItems.length - 1"
                      @click="moveFieldByDelta(field.key, 1)"
                    >
                      下移
                    </button>
                  </span>
                </div>
              </div>

              <div v-if="overflowTokenCount > 0" class="pane-hint">
                超出字段数量的 {{ overflowTokenCount }} 段已自动归为忽略
              </div>
            </div>
          </div>

          <div class="account-meta-grid account-meta-grid--footer excel-settings-box">
            <div class="pane-meta">总计 {{ stats.total }} 行，成功 {{ stats.success }}，失败 {{ stats.failed }}</div>
            <div class="pane-meta">批次分隔符：{{ parseProfile.delimiter || '未识别' }}</div>
          </div>
        </div>

        <div class="pane-card account-result-card">
          <div class="account-result-head">
            <div class="account-result-head-left">
              <div class="pane-title">结果预览</div>
              <div v-if="lastPickedLabel" class="account-picked-badge">{{ lastPickedLabel }}</div>
            </div>
            <div class="account-result-head-right">
              <div class="pane-hint">共 {{ tableRows.length }} 条</div>
            </div>
          </div>
          <div class="account-result-table-wrap">
            <el-table :data="tableRows" height="100%" empty-text="暂无结果" class="account-table" :row-class-name="rowClassName">
              <el-table-column label="#" width="70">
                <template #default="{ $index }">{{ $index + 1 }}</template>
              </el-table-column>
              <el-table-column v-for="col in tableColumns" :key="col.key" :prop="col.key" :label="col.label" :min-width="col.minWidth">
                <template #default="{ row, $index }">
                  <div
                    v-if="col.key !== '__otp_code__'"
                    class="account-cell"
                    :title="String(row[col.key] || '')"
                    :class="{
                      'account-cell-selected': selectedRowIndex === $index && selectedColKey === col.key,
                    }"
                    @click="onTableCellClick(row, col.key, $index)"
                  >
                    {{ row[col.key] }}
                  </div>
                  <div
                    v-else
                    class="account-otp-cell"
                    :class="{
                      'account-cell-selected': selectedRowIndex === $index && selectedColKey === col.key,
                      'account-otp-sleeping': isOtpSleeping(row, $index),
                    }"
                    @click="onOtpCellClick(row, $index)"
                  >
                    <div class="account-otp-ep">
                      <el-tag
                        class="account-otp-tag"
                        :type="otpTagType(getOtpState(row, $index)?.remaining, !!getOtpState(row, $index)?.code)"
                        effect="light"
                        round
                      >
                        <span class="account-otp-tag-text">
                          {{ getOtpState(row, $index)?.code || '未生成' }}
                        </span>
                      </el-tag>
                      <div class="account-otp-meter">
                        <el-progress
                          class="account-otp-progress"
                          :percentage="otpProgressPercent(getOtpState(row, $index))"
                          :color="otpProgressColor(getOtpState(row, $index)?.remaining, !!getOtpState(row, $index)?.code)"
                          :stroke-width="6"
                          :show-text="false"
                          :striped="!!getOtpState(row, $index)?.code"
                          :striped-flow="!!getOtpState(row, $index)?.code"
                        />
                        <span
                          class="account-otp-meter-label"
                          :class="[
                            otpCountdownLevel(getOtpState(row, $index)?.remaining),
                            { 'is-idle': !getOtpState(row, $index)?.code },
                          ]"
                        >
                          {{ getOtpState(row, $index)?.code ? `剩余 ${getOtpState(row, $index).remaining}s` : '点击生成' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import TopNav from '../components/TopNav.vue'
import { parseAccountBatch } from '../utils/accountParser'
import { generateCurrentOtpPayload } from '../utils/totp'

const LAST_PROFILE_KEY = 'account_formatter_v2_last_profile'
const ROLE_REGISTRY_KEY = 'account_formatter_v3_role_registry'
const CUSTOM_ROLE_KEY = 'account_formatter_v3_custom_roles'
const FIELD_ORDER_KEY = 'account_formatter_v3_field_order'
const COLUMN_TRIM_RULES_KEY = 'account_formatter_v3_column_trim_rules'
const DEFAULT_DELIMITER = '----'

const BUILTIN_ROLE_REGISTRY = [
  { key: 'ignore', label: '忽略', builtin: true },
  { key: 'account', label: '账号', builtin: true },
  { key: 'password', label: '密码', builtin: true },
  { key: 'twofa', label: '2FA', builtin: true },
  { key: 'token', label: 'Token', builtin: true },
  { key: 'recovery_email', label: '辅助邮箱', builtin: true },
  { key: 'recovery_email_password', label: '邮箱密码', builtin: true },
  { key: 'cookie', label: 'Cookie', builtin: true },
]

const DEFAULT_FIELD_ORDER = ['account', 'password', 'twofa', 'recovery_email', 'recovery_email_password', 'token', 'cookie', 'ignore']

const builtinColumns = {
  account: { key: 'account', label: '账号', minWidth: 180 },
  password: { key: 'password', label: '密码', minWidth: 160 },
  twofa: { key: 'twofa', label: '2FA', minWidth: 180 },
  token: { key: 'token', label: 'Token', minWidth: 180 },
  recovery_email: { key: 'recovery_email', label: '辅助邮箱', minWidth: 180 },
  recovery_email_password: { key: 'recovery_email_password', label: '辅助邮箱密码', minWidth: 180 },
  cookie: { key: 'cookie', label: 'Cookie', minWidth: 220 },
}

const rawInput = ref('')
const delimiterInput = ref(DEFAULT_DELIMITER)
const parsing = ref(false)
const parseProfile = ref({ delimiterMode: 'fixed', delimiter: '', confidence: 0, candidates: [], warnings: [] })
const stats = ref({ total: 0, success: 0, failed: 0 })
const parsedRows = ref([])
const failedRows = ref([])
const parseWorker = ref(null)
const syncTimer = ref(null)
const parseSeq = ref(0)
const positionRoles = ref(['account', 'password', 'ignore', 'ignore'])
const roleRegistry = ref([])
const sessionCustomRoles = ref([])
const sessionAutoRoles = ref([])
const orderedFields = ref([])
const dragFieldKey = ref('')
const newCustomFieldName = ref('')
const autoRoleSeq = ref(1)
const cachedMaxTokenCount = ref(0)
const columnTrimRules = ref({})
const trimEditorField = ref('token')
const selectedRowIndex = ref(-1)
const selectedColKey = ref('')
const lastPickedLabel = ref('')
const otpStateByRow = ref({})
const otpTicker = ref(null)
const otpTicking = ref(false)
const OTP_SLEEP_MS = 90 * 1000

const isCustomRole = (role) => String(role || '').startsWith('custom:')
const isAutoRole = (role) => String(role || '').startsWith('auto:field_')

const roleRegistryForUi = computed(() => {
  const map = new Map()
  roleRegistry.value.forEach((item) => map.set(item.key, item))
  sessionCustomRoles.value.forEach((item) => map.set(item.key, item))
  sessionAutoRoles.value.forEach((item) => map.set(item.key, item))
  return Array.from(map.values())
})

const roleMap = computed(() => {
  const map = new Map()
  roleRegistryForUi.value.forEach((item) => map.set(item.key, item))
  return map
})
const roleLabelForKey = (key) => roleMap.value.get(key)?.label || key
const customRoleKeys = computed(() => sessionCustomRoles.value.map((item) => item.key))
const autoRoleKeys = computed(() => sessionAutoRoles.value.map((item) => item.key))

const sampleTokens = computed(() => {
  const fromSuccess = parsedRows.value.find((row) => Array.isArray(row.tokens) && row.tokens.length)
  if (fromSuccess) return fromSuccess.tokens
  const fromFail = failedRows.value.find((row) => Array.isArray(row.tokens) && row.tokens.length)
  return fromFail?.tokens || []
})
const activeSortCount = computed(() => sampleTokens.value.length)
const orderedFieldItems = computed(() =>
  orderedFields.value.map((key, idx) => ({
    key,
    label: roleLabelForKey(key),
    active: idx < activeSortCount.value,
    rank: idx + 1,
  })),
)
const overflowTokenCount = computed(() => Math.max(sampleTokens.value.length - orderedFields.value.length, 0))

const fallbackDisplayFieldKey = computed(() => {
  const firstOrdered = orderedFields.value.find((key) => key && key !== 'ignore')
  if (firstOrdered) return firstOrdered
  const firstRegistry = roleRegistryForUi.value.find((item) => item?.key && item.key !== 'ignore')?.key
  return firstRegistry || 'account'
})

const buildFailedDisplayRow = (item, index) => {
  const row = {
    account: '',
    password: '',
    twofa: '',
    token: '',
    cookie: '',
    recovery_email: '',
    recovery_email_password: '',
  }
  roleRegistryForUi.value.forEach((role) => {
    const key = String(role?.key || '').trim()
    if (!key || key === 'ignore' || Object.prototype.hasOwnProperty.call(row, key)) return
    row[key] = ''
  })
  const targetKey = fallbackDisplayFieldKey.value
  const raw = String(item?.raw ?? '')
  row[targetKey] = raw || String((item?.tokens || []).join(' '))
  row.tokens = Array.isArray(item?.tokens) ? [...item.tokens] : []
  row.meta = {
    delimiter: String(item?.delimiterGuess || ''),
    confidence: 0,
    sourceLine: Number(item?.line || index + 1),
    fallbackDisplay: true,
    reason: String(item?.reason || ''),
  }
  return row
}

const failedDisplayRows = computed(() => failedRows.value.map((item, index) => buildFailedDisplayRow(item, index)))

const tableRows = computed(() => {
  const merged = [...parsedRows.value, ...failedDisplayRows.value]
  if (!merged.length) return []
  return merged
    .slice()
    .sort((a, b) => {
      const aLine = Number(a?.meta?.sourceLine || 0)
      const bLine = Number(b?.meta?.sourceLine || 0)
      if (aLine !== bLine) return aLine - bLine
      return Number(!!a?.meta?.fallbackDisplay) - Number(!!b?.meta?.fallbackDisplay)
    })
})
const tableColumns = computed(() => {
  const baseCols = []
  const used = new Set()
  const builtinOrder = DEFAULT_FIELD_ORDER.filter((key) => key !== 'ignore')
  builtinOrder.forEach((key) => {
    if (key === 'ignore' || used.has(key)) return
    used.add(key)
    if (builtinColumns[key]) baseCols.push(builtinColumns[key])
  })
  const appendIfHasValue = (key) => {
    if (!key || key === 'ignore' || used.has(key)) return
    const hasValue = tableRows.value.some((row) => String(row[key] || '').trim())
    if (!hasValue) return
    used.add(key)
    baseCols.push({ key, label: roleLabelForKey(key), minWidth: 180 })
  }
  sessionCustomRoles.value.forEach((item) => appendIfHasValue(item.key))
  sessionAutoRoles.value.forEach((item) => appendIfHasValue(item.key))
  orderedFields.value.forEach((key) => {
    if (!isCustomRole(key) && !isAutoRole(key)) return
    appendIfHasValue(key)
  })
  const verifyCol = { key: '__otp_code__', label: '2fa验证码', minWidth: 256 }
  const out = []
  baseCols.forEach((col) => {
    out.push(col)
    if (col.key === 'twofa') out.push(verifyCol)
  })
  return out
})

const tokenRoleOptions = computed(() =>
  orderedFields.value.map((key) => ({ value: key, label: roleLabelForKey(key) })),
)
const trimFieldOptions = computed(() => tokenRoleOptions.value.filter((item) => item.value !== 'ignore'))

const normalizeRuleList = (raw) =>
  String(raw || '')
    .split(/[,\n]/g)
    .map((v) => String(v || '').trim())
    .filter(Boolean)

const defaultTrimRules = () => ({
  token: { enabled: true, prefixes: ['auth_token='], suffixes: [] },
})

const normalizeTrimRules = (raw) => {
  const next = defaultTrimRules()
  if (!raw || typeof raw !== 'object') return next
  Object.entries(raw).forEach(([key, value]) => {
    if (!key || key === 'ignore') return
    const prefixes = Array.isArray(value?.prefixes) ? value.prefixes.map((v) => String(v || '').trim()).filter(Boolean) : []
    const suffixes = Array.isArray(value?.suffixes) ? value.suffixes.map((v) => String(v || '').trim()).filter(Boolean) : []
    next[key] = { enabled: value?.enabled !== false, prefixes, suffixes }
  })
  return next
}

const EMPTY_TRIM_RULE = { enabled: false, prefixes: [], suffixes: [] }
const getTrimRule = (key) => columnTrimRules.value[key] || EMPTY_TRIM_RULE
const ensureTrimRuleExists = (key) => {
  if (!key || key === 'ignore' || columnTrimRules.value[key]) return
  columnTrimRules.value = { ...columnTrimRules.value, [key]: { enabled: false, prefixes: [], suffixes: [] } }
}

const trimEnabled = computed({
  get: () => !!getTrimRule(trimEditorField.value)?.enabled,
  set: (val) => {
    const key = trimEditorField.value
    if (!key) return
    const current = getTrimRule(key)
    columnTrimRules.value = { ...columnTrimRules.value, [key]: { ...current, enabled: !!val } }
  },
})

const trimPrefixInput = computed({
  get: () => {
    const current = getTrimRule(trimEditorField.value)
    return (current.prefixes || []).join(', ')
  },
  set: (val) => {
    const key = trimEditorField.value
    if (!key) return
    const current = getTrimRule(key)
    columnTrimRules.value = {
      ...columnTrimRules.value,
      [key]: { ...current, prefixes: normalizeRuleList(val) },
    }
  },
})

const trimSuffixInput = computed({
  get: () => {
    const current = getTrimRule(trimEditorField.value)
    return (current.suffixes || []).join(', ')
  },
  set: (val) => {
    const key = trimEditorField.value
    if (!key) return
    const current = getTrimRule(key)
    columnTrimRules.value = {
      ...columnTrimRules.value,
      [key]: { ...current, suffixes: normalizeRuleList(val) },
    }
  },
})

const splitTokensByDelimiter = (line, delimiter) => {
  const raw = String(line || '').trim()
  if (!raw) return []
  if (!delimiter) return [raw]
  if (delimiter === '@') {
    const idx = raw.lastIndexOf('@')
    if (idx <= 0 || idx >= raw.length - 1) return [raw]
    return [raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()].filter(Boolean)
  }
  return raw.split(delimiter).map((part) => String(part || '').trim()).filter(Boolean)
}

const maxTokenCount = () => {
  const lines = String(rawInput.value || '').split(/\r?\n/).map((line) => String(line || '').trim()).filter(Boolean)
  if (!lines.length) return 0
  const delimiter = String(delimiterInput.value || '').trim() || DEFAULT_DELIMITER
  return Math.max(...lines.map((line) => splitTokensByDelimiter(line, delimiter).length), 0)
}
const refreshMaxTokenCount = () => {
  cachedMaxTokenCount.value = maxTokenCount()
}

const ensureAutoRoles = (requiredCount) => {
  if (!Number.isFinite(requiredCount) || requiredCount <= orderedFields.value.length) return
  let nextSeq = autoRoleSeq.value
  const nextAuto = [...sessionAutoRoles.value]
  const nextOrder = [...orderedFields.value]
  while (nextOrder.length < requiredCount) {
    const key = `auto:field_${nextSeq}`
    const label = `字段${nextSeq}`
    nextSeq += 1
    if (!nextAuto.find((item) => item.key === key)) nextAuto.push({ key, label, builtin: false, transient: true, auto: true })
    if (!nextOrder.includes(key)) nextOrder.push(key)
  }
  autoRoleSeq.value = nextSeq
  sessionAutoRoles.value = nextAuto
  orderedFields.value = nextOrder
}

const applyOrderedFieldsToPositions = () => {
  const size = Math.max(4, cachedMaxTokenCount.value)
  ensureAutoRoles(size)
  const next = []
  for (let i = 0; i < size; i += 1) next[i] = orderedFields.value[i] || 'ignore'
  positionRoles.value = next
}

const scheduleParse = () => {
  if (syncTimer.value) clearTimeout(syncTimer.value)
  syncTimer.value = setTimeout(async () => {
    await runParse({ silentEmpty: true })
  }, 220)
}

const scheduleParseAfterConfigChange = ({ recalcMax = false } = {}) => {
  if (recalcMax) refreshMaxTokenCount()
  applyOrderedFieldsToPositions()
  scheduleParse()
}

const moveField = (fromIdx, toIdx) => {
  const list = [...orderedFields.value]
  if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length || fromIdx === toIdx) return
  const [moved] = list.splice(fromIdx, 1)
  list.splice(toIdx, 0, moved)
  orderedFields.value = list
  scheduleParseAfterConfigChange()
}

const moveFieldByDelta = (key, delta) => {
  const list = orderedFields.value
  const fromIdx = list.indexOf(key)
  if (fromIdx < 0) return
  const toIdx = fromIdx + Number(delta || 0)
  moveField(fromIdx, toIdx)
}

const onFieldDragStart = (event, key) => {
  dragFieldKey.value = key
  if (!event?.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', key)
}
const onFieldDragEnd = () => {
  dragFieldKey.value = ''
}
const onFieldDrop = (event, targetKey) => {
  const transferKey = event?.dataTransfer?.getData('text/plain') || ''
  const from = transferKey || dragFieldKey.value
  dragFieldKey.value = ''
  if (!from || from === targetKey) return
  const list = orderedFields.value
  moveField(list.indexOf(from), list.indexOf(targetKey))
}

const arraysEqual = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i])
const applySanitizedRoleState = () => {
  const map = new Map(BUILTIN_ROLE_REGISTRY.map((item) => [item.key, { ...item }]))
  roleRegistry.value.forEach((item) => {
    if (!item?.key || !item?.label) return
    if (!map.has(item.key)) return
    map.set(item.key, { key: item.key, label: item.label, builtin: true })
  })
  const nextRegistry = Array.from(map.values())

  const valid = new Set([
    ...nextRegistry.map((item) => item.key),
    ...sessionCustomRoles.value.map((item) => item.key),
    ...autoRoleKeys.value,
  ])
  const next = []
  orderedFields.value.forEach((key) => {
    if (valid.has(key) && !next.includes(key)) next.push(key)
  })
  DEFAULT_FIELD_ORDER.forEach((key) => {
    if (valid.has(key) && !next.includes(key)) next.push(key)
  })
  nextRegistry.forEach((item) => {
    if (!next.includes(item.key)) next.push(item.key)
  })
  sessionCustomRoles.value.forEach((item) => {
    if (!next.includes(item.key)) next.push(item.key)
  })
  sessionAutoRoles.value.forEach((item) => {
    if (!next.includes(item.key)) next.push(item.key)
  })
  if (!next.includes('ignore')) next.push('ignore')
  const nextPositions = (positionRoles.value || []).map((key, idx) => {
    if (next.includes(key)) return key
    return next[idx] || 'ignore'
  })
  const currentRegistryKeys = roleRegistry.value.map((item) => `${item.key}:${item.label}`)
  const nextRegistryKeys = nextRegistry.map((item) => `${item.key}:${item.label}`)
  if (!arraysEqual(currentRegistryKeys, nextRegistryKeys)) roleRegistry.value = nextRegistry
  if (!arraysEqual(orderedFields.value, next)) orderedFields.value = next
  if (!arraysEqual(positionRoles.value, nextPositions)) positionRoles.value = nextPositions
}

const loadState = () => {
  try {
    const raw = localStorage.getItem(ROLE_REGISTRY_KEY)
    const parsed = raw ? JSON.parse(raw) : [...BUILTIN_ROLE_REGISTRY]
    const builtinKeys = new Set(BUILTIN_ROLE_REGISTRY.map((item) => item.key))
    roleRegistry.value = Array.isArray(parsed) ? parsed.filter((item) => builtinKeys.has(item?.key)) : [...BUILTIN_ROLE_REGISTRY]
  } catch {
    roleRegistry.value = [...BUILTIN_ROLE_REGISTRY]
  }
  try {
    const raw = localStorage.getItem(FIELD_ORDER_KEY)
    orderedFields.value = raw ? JSON.parse(raw) : [...DEFAULT_FIELD_ORDER]
  } catch {
    orderedFields.value = [...DEFAULT_FIELD_ORDER]
  }
  try {
    const raw = localStorage.getItem(CUSTOM_ROLE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    sessionCustomRoles.value = Array.isArray(parsed)
      ? parsed
          .map((item) => ({ key: String(item?.key || '').trim(), label: String(item?.label || '').trim(), builtin: false }))
          .filter((item) => item.key && item.label)
      : []
  } catch {
    sessionCustomRoles.value = []
  }
  try {
    const raw = localStorage.getItem(COLUMN_TRIM_RULES_KEY)
    columnTrimRules.value = normalizeTrimRules(raw ? JSON.parse(raw) : null)
  } catch {
    columnTrimRules.value = defaultTrimRules()
  }
  sessionAutoRoles.value = []
  autoRoleSeq.value = 1
  refreshMaxTokenCount()
  applySanitizedRoleState()
  applyOrderedFieldsToPositions()
  trimFieldOptions.value.forEach((item) => ensureTrimRuleExists(item.value))
  if (!orderedFields.value.includes(trimEditorField.value)) {
    trimEditorField.value = trimFieldOptions.value[0]?.value || 'token'
  }
}

const buildCustomRoleKey = (label) => {
  const base = String(label || '').trim().toLowerCase().replace(/\s+/g, '_') || 'field'
  let key = `custom:${base}`
  let seq = 2
  const keys = new Set(roleRegistryForUi.value.map((item) => item.key))
  while (keys.has(key)) {
    key = `custom:${base}_${seq}`
    seq += 1
  }
  return key
}

const addCustomRole = () => {
  const label = String(newCustomFieldName.value || '').trim()
  if (!label) return ElMessage.warning('请输入字段名')
  if (roleRegistryForUi.value.some((item) => item.label === label)) return ElMessage.warning('字段名已存在')
  const key = buildCustomRoleKey(label)
  sessionCustomRoles.value = [...sessionCustomRoles.value, { key, label, builtin: false, transient: true }]
  ensureTrimRuleExists(key)
  if (!orderedFields.value.includes(key)) orderedFields.value = [...orderedFields.value, key]
  newCustomFieldName.value = ''
  applySanitizedRoleState()
  scheduleParseAfterConfigChange()
  ElMessage.success('已新增字段')
}

const resetFieldOrder = () => {
  orderedFields.value = [...DEFAULT_FIELD_ORDER, ...sessionCustomRoles.value.map((item) => item.key), ...autoRoleKeys.value]
  applySanitizedRoleState()
  scheduleParseAfterConfigChange()
  ElMessage.success('已恢复默认排序')
}

const getPreferredDelimiter = () => String(delimiterInput.value || '').trim() || DEFAULT_DELIMITER
const trimValueByRule = (value, rule) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (!rule?.enabled) return raw
  let next = raw
  const prefixes = [...(rule.prefixes || [])].sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (prefix && next.startsWith(prefix)) {
      next = next.slice(prefix.length).trim()
      break
    }
  }
  const suffixes = [...(rule.suffixes || [])].sort((a, b) => b.length - a.length)
  for (const suffix of suffixes) {
    if (suffix && next.endsWith(suffix)) {
      next = next.slice(0, next.length - suffix.length).trim()
      break
    }
  }
  return next
}
const applyColumnTrim = (row) => {
  const next = { ...row }
  Object.entries(columnTrimRules.value || {}).forEach(([fieldKey, rule]) => {
    if (!rule?.enabled) return
    if (!Object.prototype.hasOwnProperty.call(next, fieldKey)) return
    next[fieldKey] = trimValueByRule(next[fieldKey], rule)
  })
  return next
}
const parseOptions = () => ({ preferredDelimiter: getPreferredDelimiter(), positionRoles: [...positionRoles.value], customRoleKeys: [...customRoleKeys.value] })
const parseInMainThread = () => parseAccountBatch(rawInput.value, parseOptions())
const parseWithWorker = () =>
  new Promise((resolve, reject) => {
    if (!parseWorker.value) parseWorker.value = new Worker(new URL('../workers/accountParser.worker.js', import.meta.url), { type: 'module' })
    const handleMessage = (event) => {
      if (event?.data?.type !== 'result') return
      parseWorker.value.removeEventListener('message', handleMessage)
      resolve(event.data.result)
    }
    const handleError = (err) => {
      parseWorker.value.removeEventListener('error', handleError)
      reject(err)
    }
    parseWorker.value.addEventListener('message', handleMessage)
    parseWorker.value.addEventListener('error', handleError, { once: true })
    parseWorker.value.postMessage({ type: 'parse', rawInput: rawInput.value, options: parseOptions() })
  })

const runParse = async ({ silentEmpty = true } = {}) => {
  const lines = String(rawInput.value || '').split(/\r?\n/).filter((line) => String(line || '').trim())
  if (!lines.length) {
    if (!silentEmpty) ElMessage.warning('请输入至少一行账号卡密')
    return
  }
  const requestId = parseSeq.value + 1
  parseSeq.value = requestId
  parsing.value = true
  try {
    const result = lines.length > 1500 ? await parseWithWorker() : parseInMainThread()
    if (requestId !== parseSeq.value) return
    parsedRows.value = (result.parsedRows || []).map((row) => applyColumnTrim(row))
    failedRows.value = result.failedRows || []
    parseProfile.value = result.profile || { delimiterMode: 'fixed', delimiter: '', confidence: 0, candidates: [], warnings: [] }
    stats.value = result.stats || { total: lines.length, success: 0, failed: 0 }
    localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(parseProfile.value))
  } catch (err) {
    console.error('[AccountFormatter] parse failed', err)
  } finally {
    if (requestId === parseSeq.value) parsing.value = false
  }
}

const copyText = async (value, msg) => {
  const text = String(value || '')
  if (!text) return ElMessage.warning('没有可复制内容')
  await navigator.clipboard.writeText(text)
  ElMessage.success({ message: msg || '已复制', duration: 900, grouping: true })
}

const rowOtpKey = (row, rowIndex) => {
  const sourceLine = Number(row?.meta?.sourceLine)
  return Number.isFinite(sourceLine) && sourceLine > 0 ? `line_${sourceLine}` : `row_${rowIndex}`
}

const getOtpState = (row, rowIndex) => otpStateByRow.value[rowOtpKey(row, rowIndex)] || null
const isOtpSleeping = (row, rowIndex) => !!getOtpState(row, rowIndex)?.sleeping
const otpCountdownLevel = (remaining) => {
  const sec = Number(remaining || 0)
  if (sec <= 8) return 'is-danger'
  if (sec <= 16) return 'is-warn'
  return 'is-safe'
}

const otpProgressPercent = (state) => {
  const remaining = Number(state?.remaining || 0)
  const period = Number(state?.period || 0)
  if (!state?.code || !period) return 0
  const percent = Math.round((remaining / period) * 100)
  return Math.max(0, Math.min(100, percent))
}

const otpProgressColor = (remaining, active) => {
  if (!active) return 'rgba(148, 163, 184, 0.65)'
  const sec = Number(remaining || 0)
  if (sec <= 8) return '#ef4444'
  if (sec <= 16) return '#f59e0b'
  return '#14b8a6'
}

const otpTagType = (remaining, active) => {
  if (!active) return 'info'
  const sec = Number(remaining || 0)
  if (sec <= 8) return 'danger'
  if (sec <= 16) return 'warning'
  return 'success'
}

const setOtpState = (rowKey, nextState) => {
  otpStateByRow.value = { ...otpStateByRow.value, [rowKey]: nextState }
}

const startOtpTicker = () => {
  if (otpTicker.value) return
  otpTicker.value = setInterval(() => {
    tickOtpStates()
  }, 1000)
}

const stopOtpTicker = () => {
  if (!otpTicker.value) return
  clearInterval(otpTicker.value)
  otpTicker.value = null
}

const ensureOtpTicker = () => {
  const hasActive = Object.values(otpStateByRow.value).some((item) => item && !item.sleeping && item.raw2fa)
  if (hasActive) startOtpTicker()
  else stopOtpTicker()
}

const activateOtpRow = async (row, rowIndex) => {
  const raw2fa = String(row?.twofa || '').trim()
  const rowKey = rowOtpKey(row, rowIndex)
  const payload = await generateCurrentOtpPayload(raw2fa)
  if (!payload?.isValid || !payload.code) return false
  setOtpState(rowKey, {
    rowKey,
    raw2fa,
    code: payload.code,
    period: payload.period,
    remaining: payload.remaining,
    expiresAt: payload.expiresAt,
    lastActiveAt: Date.now(),
    sleeping: false,
  })
  ensureOtpTicker()
  await copyText(payload.code, '已复制2FA验证码')
  lastPickedLabel.value = `刚复制：第 ${rowIndex + 1} 行 · 2fa验证码`
  return true
}

const tickOtpStates = async () => {
  if (otpTicking.value) return
  otpTicking.value = true
  try {
    const now = Date.now()
    let changed = false
    const nextStates = { ...otpStateByRow.value }
    const keys = Object.keys(nextStates)
    for (const key of keys) {
      const item = nextStates[key]
      if (!item || item.sleeping) continue
      if (now - Number(item.lastActiveAt || 0) >= OTP_SLEEP_MS) {
        nextStates[key] = { ...item, code: '', remaining: 0, expiresAt: 0, sleeping: true }
        changed = true
        continue
      }
      if (now >= Number(item.expiresAt || 0)) {
        const payload = await generateCurrentOtpPayload(item.raw2fa)
        if (!payload?.isValid || !payload.code) {
          nextStates[key] = { ...item, code: '', remaining: 0, expiresAt: 0, sleeping: true }
        } else {
          nextStates[key] = {
            ...item,
            code: payload.code,
            period: payload.period,
            remaining: payload.remaining,
            expiresAt: payload.expiresAt,
          }
        }
        changed = true
        continue
      }
      const nextRemaining = Math.max(0, Math.ceil((Number(item.expiresAt) - now) / 1000))
      if (nextRemaining !== item.remaining) {
        nextStates[key] = { ...item, remaining: nextRemaining }
        changed = true
      }
    }
    if (changed) otpStateByRow.value = nextStates
    ensureOtpTicker()
  } finally {
    otpTicking.value = false
  }
}

const onTableCellClick = async (row, colKey, rowIndex) => {
  selectedRowIndex.value = rowIndex
  selectedColKey.value = colKey
  if (colKey === '__otp_code__') return onOtpCellClick(row, rowIndex)
  lastPickedLabel.value = `刚复制：第 ${rowIndex + 1} 行 · ${roleLabelForKey(colKey)}`
  const raw = row?.[colKey]
  return copyText(raw, colKey === 'twofa' ? '已复制2FA原值' : `已复制${roleLabelForKey(colKey)}`)
}

const onOtpCellClick = async (row, rowIndex) => {
  selectedRowIndex.value = rowIndex
  selectedColKey.value = '__otp_code__'
  const activated = await activateOtpRow(row, rowIndex)
  if (activated) return
  return copyText(row?.twofa, '2FA格式无效，已复制原值')
}

const rowClassName = ({ rowIndex }) => (rowIndex === selectedRowIndex.value ? 'account-row-selected' : '')

const clearAll = () => {
  if (syncTimer.value) clearTimeout(syncTimer.value)
  rawInput.value = ''
  parsedRows.value = []
  failedRows.value = []
  stats.value = { total: 0, success: 0, failed: 0 }
  parseProfile.value = { delimiterMode: 'fixed', delimiter: '', confidence: 0, candidates: [], warnings: [] }
  sessionCustomRoles.value = []
  sessionAutoRoles.value = []
  autoRoleSeq.value = 1
  orderedFields.value = orderedFields.value.filter((key) => !isAutoRole(key))
  applySanitizedRoleState()
  cachedMaxTokenCount.value = 0
  positionRoles.value = ['account', 'password', 'ignore', 'ignore']
  selectedRowIndex.value = -1
  selectedColKey.value = ''
  otpStateByRow.value = {}
  stopOtpTicker()
}

loadState()

onBeforeUnmount(() => {
  if (syncTimer.value) clearTimeout(syncTimer.value)
  if (parseWorker.value) parseWorker.value.terminate()
  stopOtpTicker()
})

watch(rawInput, (value) => {
  refreshMaxTokenCount()
  if (!String(value || '').trim()) {
    parsedRows.value = []
    failedRows.value = []
    stats.value = { total: 0, success: 0, failed: 0 }
    parseProfile.value = { delimiterMode: 'fixed', delimiter: '', confidence: 0, candidates: [], warnings: [] }
    otpStateByRow.value = {}
    stopOtpTicker()
    return
  }
  scheduleParseAfterConfigChange()
})

watch(delimiterInput, () => {
  refreshMaxTokenCount()
  if (!String(rawInput.value || '').trim()) return
  scheduleParseAfterConfigChange()
})

watch([roleRegistry, orderedFields, sessionCustomRoles], () => {
  localStorage.setItem(ROLE_REGISTRY_KEY, JSON.stringify(roleRegistry.value))
  localStorage.setItem(CUSTOM_ROLE_KEY, JSON.stringify(sessionCustomRoles.value))
  localStorage.setItem(FIELD_ORDER_KEY, JSON.stringify(orderedFields.value.filter((key) => !isAutoRole(key))))
}, { deep: true })

watch(columnTrimRules, (value) => {
  localStorage.setItem(COLUMN_TRIM_RULES_KEY, JSON.stringify(value || {}))
  const nextRows = parsedRows.value.map((row) => applyColumnTrim(row))
  const changed = nextRows.some((row, idx) => JSON.stringify(row) !== JSON.stringify(parsedRows.value[idx]))
  if (changed) parsedRows.value = nextRows
}, { deep: true })

watch(trimFieldOptions, (options) => {
  if (options.some((item) => item.value === trimEditorField.value)) return
  trimEditorField.value = options[0]?.value || 'token'
}, { deep: true })

watch(trimEditorField, (fieldKey) => {
  ensureTrimRuleExists(fieldKey)
})

watch(tableRows, (rows) => {
  const keys = new Set(rows.map((row, idx) => rowOtpKey(row, idx)))
  const next = {}
  Object.entries(otpStateByRow.value).forEach(([key, value]) => {
    if (keys.has(key)) next[key] = value
  })
  otpStateByRow.value = next
  ensureOtpTicker()
}, { deep: true })
</script>
