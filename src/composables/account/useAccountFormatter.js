import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  BUILTIN_ROLE_REGISTRY,
  COLUMN_TRIM_RULES_KEY,
  createEmptyParseProfile,
  CUSTOM_ROLE_KEY,
  DEFAULT_DELIMITER,
  DEFAULT_FIELD_ORDER,
  FIELD_ORDER_KEY,
  builtinColumns,
  LAST_PROFILE_KEY,
  ROLE_REGISTRY_KEY,
} from './modules/constants'
import {
  applyColumnTrimByRules,
  defaultTrimRules,
  EMPTY_TRIM_RULE,
  normalizeRuleList,
  normalizeTrimRules,
} from './modules/trimRules'
import { useAccountParse } from './modules/useAccountParse'
import { useAccountOtp } from './modules/useAccountOtp'

export function useAccountFormatter() {
  const rawInput = ref('')
  const delimiterInput = ref(DEFAULT_DELIMITER)
  const parsing = ref(false)
  const parseProfile = ref(createEmptyParseProfile())
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

  const columnTrimRules = ref(defaultTrimRules())
  const trimEditorField = ref('token')

  const selectedRowIndex = ref(-1)
  const selectedColKey = ref('')
  const lastPickedLabel = ref('')

  const isCustomRole = (role) => String(role || '').startsWith('custom:')
  const isAutoRole = (role) => String(role || '').startsWith('auto:field_')
  const arraysEqual = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i])

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
    return merged.slice().sort((a, b) => {
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

  const getTrimRule = (key) => columnTrimRules.value[key] || EMPTY_TRIM_RULE
  const ensureTrimRuleExists = (key) => {
    if (!key || key === 'ignore' || columnTrimRules.value[key]) return
    columnTrimRules.value = {
      ...columnTrimRules.value,
      [key]: { enabled: false, prefixes: [], suffixes: [] },
    }
  }

  const trimEnabled = computed({
    get: () => !!getTrimRule(trimEditorField.value)?.enabled,
    set: (val) => {
      const key = trimEditorField.value
      if (!key) return
      const current = getTrimRule(key)
      columnTrimRules.value = {
        ...columnTrimRules.value,
        [key]: { ...current, enabled: !!val },
      }
    },
  })

  const trimPrefixInput = computed({
    get: () => (getTrimRule(trimEditorField.value).prefixes || []).join(', '),
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
    get: () => (getTrimRule(trimEditorField.value).suffixes || []).join(', '),
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

    return raw
      .split(delimiter)
      .map((part) => String(part || '').trim())
      .filter(Boolean)
  }

  const maxTokenCount = () => {
    const lines = String(rawInput.value || '')
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
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

      if (!nextAuto.find((item) => item.key === key)) {
        nextAuto.push({ key, label, builtin: false, transient: true, auto: true })
      }
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
      roleRegistry.value = Array.isArray(parsed)
        ? parsed.filter((item) => builtinKeys.has(item?.key))
        : [...BUILTIN_ROLE_REGISTRY]
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
            .map((item) => ({
              key: String(item?.key || '').trim(),
              label: String(item?.label || '').trim(),
              builtin: false,
            }))
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
    const base = String(label || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_') || 'field'

    let key = `custom:${base}`
    let seq = 2
    const keys = new Set(roleRegistryForUi.value.map((item) => item.key))
    while (keys.has(key)) {
      key = `custom:${base}_${seq}`
      seq += 1
    }
    return key
  }

  const getPreferredDelimiter = () => String(delimiterInput.value || '').trim() || DEFAULT_DELIMITER
  const applyColumnTrim = (row) => applyColumnTrimByRules(row, columnTrimRules.value)
  const getParseOptions = () => ({
    preferredDelimiter: getPreferredDelimiter(),
    positionRoles: [...positionRoles.value],
    customRoleKeys: [...customRoleKeys.value],
  })

  const { runParse } = useAccountParse({
    rawInput,
    parsing,
    parseSeq,
    parseWorker,
    parsedRows,
    failedRows,
    parseProfile,
    stats,
    applyColumnTrim,
    getParseOptions,
    lastProfileKey: LAST_PROFILE_KEY,
  })

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

  const addCustomRole = () => {
    const label = String(newCustomFieldName.value || '').trim()
    if (!label) return ElMessage.warning('请输入字段名')
    if (roleRegistryForUi.value.some((item) => item.label === label)) return ElMessage.warning('字段名已存在')

    const key = buildCustomRoleKey(label)
    sessionCustomRoles.value = [
      ...sessionCustomRoles.value,
      { key, label, builtin: false, transient: true },
    ]
    ensureTrimRuleExists(key)
    if (!orderedFields.value.includes(key)) orderedFields.value = [...orderedFields.value, key]
    newCustomFieldName.value = ''

    applySanitizedRoleState()
    scheduleParseAfterConfigChange()
    ElMessage.success('已新增字段')
  }

  const resetFieldOrder = () => {
    orderedFields.value = [
      ...DEFAULT_FIELD_ORDER,
      ...sessionCustomRoles.value.map((item) => item.key),
      ...autoRoleKeys.value,
    ]
    applySanitizedRoleState()
    scheduleParseAfterConfigChange()
    ElMessage.success('已恢复默认排序')
  }

  const copyText = async (value, msg) => {
    const text = String(value || '')
    if (!text) return ElMessage.warning('没有可复制内容')
    await navigator.clipboard.writeText(text)
    ElMessage.success({ message: msg || '已复制', duration: 900, grouping: true })
  }

  const {
    getOtpState,
    isOtpSleeping,
    otpPhaseClass,
    otpHasCode,
    otpDisplayCode,
    otpCountdownText,
    isOtpHovering,
    otpProgressPercent,
    otpProgressColor,
    otpCellStyle,
    onOtpPointerEnter,
    onOtpPointerMove,
    onOtpPointerLeave,
    onTableCellClick,
    onOtpCellClick,
    rowClassName,
    stopOtpTicker,
    resetOtpState,
  } = useAccountOtp({
    tableRows,
    selectedRowIndex,
    selectedColKey,
    lastPickedLabel,
    roleLabelForKey,
    copyText,
  })

  const clearAll = () => {
    if (syncTimer.value) clearTimeout(syncTimer.value)
    rawInput.value = ''
    parsedRows.value = []
    failedRows.value = []
    stats.value = { total: 0, success: 0, failed: 0 }
    parseProfile.value = createEmptyParseProfile()

    sessionCustomRoles.value = []
    sessionAutoRoles.value = []
    autoRoleSeq.value = 1
    orderedFields.value = orderedFields.value.filter((key) => !isAutoRole(key))
    applySanitizedRoleState()
    cachedMaxTokenCount.value = 0
    positionRoles.value = ['account', 'password', 'ignore', 'ignore']

    selectedRowIndex.value = -1
    selectedColKey.value = ''
    lastPickedLabel.value = ''
    resetOtpState()
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
      parseProfile.value = createEmptyParseProfile()
      resetOtpState()
      return
    }
    scheduleParseAfterConfigChange()
  })

  watch(delimiterInput, () => {
    refreshMaxTokenCount()
    if (!String(rawInput.value || '').trim()) return
    scheduleParseAfterConfigChange()
  })

  watch(
    [roleRegistry, orderedFields, sessionCustomRoles],
    () => {
      localStorage.setItem(ROLE_REGISTRY_KEY, JSON.stringify(roleRegistry.value))
      localStorage.setItem(CUSTOM_ROLE_KEY, JSON.stringify(sessionCustomRoles.value))
      localStorage.setItem(
        FIELD_ORDER_KEY,
        JSON.stringify(orderedFields.value.filter((key) => !isAutoRole(key))),
      )
    },
    { deep: true },
  )

  watch(
    columnTrimRules,
    (value) => {
      localStorage.setItem(COLUMN_TRIM_RULES_KEY, JSON.stringify(value || {}))
      const nextRows = parsedRows.value.map((row) => applyColumnTrim(row))
      const changed = nextRows.some((row, idx) => JSON.stringify(row) !== JSON.stringify(parsedRows.value[idx]))
      if (changed) parsedRows.value = nextRows
    },
    { deep: true },
  )

  watch(
    trimFieldOptions,
    (options) => {
      if (options.some((item) => item.value === trimEditorField.value)) return
      trimEditorField.value = options[0]?.value || 'token'
    },
    { deep: true },
  )

  watch(trimEditorField, (fieldKey) => {
    ensureTrimRuleExists(fieldKey)
  })

  return {
    rawInput,
    delimiterInput,
    trimEnabled,
    trimEditorField,
    trimFieldOptions,
    trimPrefixInput,
    trimSuffixInput,
    sampleTokens,
    activeSortCount,
    orderedFieldItems,
    newCustomFieldName,
    dragFieldKey,
    overflowTokenCount,
    stats,
    parseProfile,
    selectedRowIndex,
    selectedColKey,
    lastPickedLabel,
    tableRows,
    tableColumns,
    moveFieldByDelta,
    onFieldDragStart,
    onFieldDragEnd,
    onFieldDrop,
    addCustomRole,
    resetFieldOrder,
    onTableCellClick,
    onOtpCellClick,
    rowClassName,
    getOtpState,
    isOtpSleeping,
    otpPhaseClass,
    otpHasCode,
    otpDisplayCode,
    otpCountdownText,
    isOtpHovering,
    otpProgressPercent,
    otpProgressColor,
    otpCellStyle,
    onOtpPointerEnter,
    onOtpPointerMove,
    onOtpPointerLeave,
    clearAll,
  }
}
