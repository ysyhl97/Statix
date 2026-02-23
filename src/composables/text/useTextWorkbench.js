import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useTextWorkbench() {
  const STORAGE_KEY = 'text_workbench_v1'
  const MAX_HISTORY = 100
  const INPUT_MERGE_MS = 800
  const DEFAULT_FONT_SIZE = 18
  const MIN_FONT_SIZE = 12
  const MAX_FONT_SIZE = 32
  const DEFAULT_TAB_PREFIX = '新标签'
  const LEGACY_TAB_PREFIX = '暂存'
  const VALID_REGEX_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'y'])
  const MAX_REGEX_PREVIEW_MATCHES = 5000
  
  const tabs = ref([])
  const activeTabId = ref('')
  const configDialogVisible = ref(false)
  const editorFontSize = ref(DEFAULT_FONT_SIZE)
  const activeCaretLine = ref(1)
  
  const regexPattern = ref('')
  const regexReplacement = ref('')
  const regexFlags = ref('g')
  const affixPrefix = ref('')
  const affixSuffix = ref('')
  const regexMatches = ref([])
  const activeMatchIndex = ref(-1)
  const regexPreviewError = ref('')
  
  const editorRef = ref(null)
  const gutterRef = ref(null)
  
  const historyByTab = reactive({})
  const pendingInputBaseByTab = reactive({})
  const inputTimerByTab = new Map()
  
  let persistTimer = null
  let textareaScrollEl = null
  
  const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) || null)
  const activeText = computed(() => activeTab.value?.text || '')
  
  const splitLines = (text) => String(text ?? '').split(/\r\n|\n|\r/)
  const joinLines = (lines) => (Array.isArray(lines) ? lines.join('\n') : '')
  const clampFontSize = (value) =>
    Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Number.isFinite(Number(value)) ? Number(value) : DEFAULT_FONT_SIZE))
  
  const countLines = (text) => splitLines(text).length
  const activeLineCount = computed(() => countLines(activeText.value))
  const lineNumbers = computed(() => Array.from({ length: activeLineCount.value }, (_, i) => i + 1))
  const regexMatchCount = computed(() => regexMatches.value.length)
  const matchedLineSet = computed(() => {
    const set = new Set()
    for (const item of regexMatches.value) {
      set.add(item.lineNo)
    }
    return set
  })
  const activeMatchIndexLabel = computed(() => {
    if (!regexMatchCount.value || activeMatchIndex.value < 0) return '0/0'
    return `${activeMatchIndex.value + 1}/${regexMatchCount.value}`
  })
  const editorStyleVars = computed(() => {
    const size = clampFontSize(editorFontSize.value)
    const lineHeight = Math.round(size * 1.56)
    return {
      '--text-editor-font-size': `${size}px`,
      '--text-editor-line-height': `${lineHeight}px`,
    }
  })
  
  const canUndo = computed(() => {
    const tab = activeTab.value
    if (!tab) return false
    const history = historyByTab[tab.id]
    return !!history?.undo?.length || pendingInputBaseByTab[tab.id] !== undefined
  })
  
  const canRedo = computed(() => {
    const tab = activeTab.value
    if (!tab) return false
    const history = historyByTab[tab.id]
    return !!history?.redo?.length
  })
  
  const createTabId = () => `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  
  const createEmptyTab = (name) => ({
    id: createTabId(),
    name,
    text: '',
    updatedAt: Date.now(),
  })
  
  const formatDefaultTabName = (index) => `${DEFAULT_TAB_PREFIX} ${index}`

  const parseLegacyTabIndex = (name) => {
    const source = String(name || '').trim()
    const match = source.match(new RegExp(`^${LEGACY_TAB_PREFIX}(?:\\s*(\\d+))?$`))
    if (!match) return null

    const idx = Number(match[1])
    if (Number.isFinite(idx) && idx > 0) return idx
    return 1
  }

  const createNextTabName = (usedNames) => {
    const names = usedNames || new Set(tabs.value.map((tab) => String(tab.name || '').trim()).filter(Boolean))
    let idx = 1
    while (names.has(formatDefaultTabName(idx))) idx += 1
    return formatDefaultTabName(idx)
  }
  
  const getTabById = (tabId) => tabs.value.find((tab) => tab.id === tabId) || null
  
  const ensureHistory = (tabId) => {
    if (!historyByTab[tabId]) {
      historyByTab[tabId] = { undo: [], redo: [] }
    }
    return historyByTab[tabId]
  }
  
  const boundedPush = (stack, value) => {
    stack.push(String(value ?? ''))
    if (stack.length > MAX_HISTORY) {
      stack.splice(0, stack.length - MAX_HISTORY)
    }
  }
  
  const clearInputTimer = (tabId) => {
    const timer = inputTimerByTab.get(tabId)
    if (timer) {
      clearTimeout(timer)
      inputTimerByTab.delete(tabId)
    }
  }
  
  const commitPendingInput = (tabId) => {
    if (!tabId) return
    const base = pendingInputBaseByTab[tabId]
    if (base === undefined) return
  
    clearInputTimer(tabId)
    delete pendingInputBaseByTab[tabId]
  
    const tab = getTabById(tabId)
    if (!tab || tab.text === base) return
  
    const history = ensureHistory(tabId)
    boundedPush(history.undo, base)
    history.redo = []
  }
  
  const scheduleInputCommit = (tabId) => {
    clearInputTimer(tabId)
    const timer = setTimeout(() => commitPendingInput(tabId), INPUT_MERGE_MS)
    inputTimerByTab.set(tabId, timer)
  }
  
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistState()
    }, 300)
  }
  
  const persistState = () => {
    try {
      const payload = {
        tabs: tabs.value.map((tab) => ({
          id: String(tab.id),
          name: String(tab.name || '').trim() || '未命名',
          text: String(tab.text || ''),
          updatedAt: Number(tab.updatedAt) || Date.now(),
        })),
        activeTabId: String(activeTabId.value || ''),
        regex: {
          pattern: String(regexPattern.value || ''),
          replacement: String(regexReplacement.value || ''),
          flags: String(regexFlags.value || ''),
        },
        affix: {
          prefix: String(affixPrefix.value || ''),
          suffix: String(affixSuffix.value || ''),
        },
        ui: {
          fontSize: clampFontSize(editorFontSize.value),
        },
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {}
  }
  
  const restoreState = () => {
    const fallback = [createEmptyTab(formatDefaultTabName(1))]
    try {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (err) {}

      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        tabs.value = fallback
        activeTabId.value = fallback[0].id
        ensureHistory(fallback[0].id)
        return
      }
  
      const parsed = JSON.parse(raw)
      const restored = []
      const used = new Set()
      const usedNames = new Set()
  
      for (const item of Array.isArray(parsed?.tabs) ? parsed.tabs : []) {
        const rawId = String(item?.id || createTabId())
        const id = used.has(rawId) ? createTabId() : rawId
        used.add(id)

        const rawName = String(item?.name || '').trim()
        const legacyIdx = parseLegacyTabIndex(rawName)
        let nextName = rawName
        let shouldDedupeDefaultName = false

        if (legacyIdx !== null) {
          nextName = formatDefaultTabName(legacyIdx)
          shouldDedupeDefaultName = true
        }

        if (!nextName) {
          nextName = createNextTabName(usedNames)
          shouldDedupeDefaultName = true
        }

        if (shouldDedupeDefaultName && usedNames.has(nextName)) {
          nextName = createNextTabName(usedNames)
        }

        usedNames.add(nextName)

        restored.push({
          id,
          name: nextName,
          text: String(item?.text || ''),
          updatedAt: Number(item?.updatedAt) || Date.now(),
        })
      }
  
      tabs.value = restored.length ? restored : fallback
      activeTabId.value = tabs.value.some((tab) => tab.id === parsed?.activeTabId)
        ? parsed.activeTabId
        : tabs.value[0].id
  
      regexPattern.value = String(parsed?.regex?.pattern || '')
      regexReplacement.value = String(parsed?.regex?.replacement || '')
      regexFlags.value = String(parsed?.regex?.flags || 'g')
      affixPrefix.value = String(parsed?.affix?.prefix || '')
      affixSuffix.value = String(parsed?.affix?.suffix || '')
      editorFontSize.value = clampFontSize(parsed?.ui?.fontSize)
    } catch (err) {
      tabs.value = fallback
      activeTabId.value = fallback[0].id
      editorFontSize.value = DEFAULT_FONT_SIZE
    }
  
    tabs.value.forEach((tab) => ensureHistory(tab.id))
  }
  
  const getTextareaEl = () => editorRef.value?.textarea || editorRef.value?.$el?.querySelector('textarea') || null
  
  const syncGutterScroll = () => {
    if (!gutterRef.value || !textareaScrollEl) return
    gutterRef.value.scrollTop = textareaScrollEl.scrollTop
  }
  
  const onTextareaScroll = () => {
    syncGutterScroll()
  }

  const updateCaretLineFromTextarea = () => {
    const tab = activeTab.value
    if (!tab) {
      activeCaretLine.value = 1
      return
    }
    if (!textareaScrollEl) {
      activeCaretLine.value = 1
      return
    }

    const text = String(tab.text || '')
    const selectionStart = Number(textareaScrollEl?.selectionStart)
    const caret = Number.isFinite(selectionStart)
      ? Math.min(Math.max(selectionStart, 0), text.length)
      : 0

    activeCaretLine.value = Math.max(1, splitLines(text.slice(0, caret)).length)
  }

  const handleEditorCaretEvent = () => {
    updateCaretLineFromTextarea()
  }

  const addTextareaListeners = () => {
    if (!textareaScrollEl) return
    textareaScrollEl.addEventListener('scroll', onTextareaScroll, { passive: true })
    textareaScrollEl.addEventListener('click', handleEditorCaretEvent, { passive: true })
    textareaScrollEl.addEventListener('keyup', handleEditorCaretEvent)
    textareaScrollEl.addEventListener('mouseup', handleEditorCaretEvent)
    textareaScrollEl.addEventListener('select', handleEditorCaretEvent)
    textareaScrollEl.addEventListener('input', handleEditorCaretEvent)
  }

  const removeTextareaListeners = () => {
    if (!textareaScrollEl) return
    textareaScrollEl.removeEventListener('scroll', onTextareaScroll)
    textareaScrollEl.removeEventListener('click', handleEditorCaretEvent)
    textareaScrollEl.removeEventListener('keyup', handleEditorCaretEvent)
    textareaScrollEl.removeEventListener('mouseup', handleEditorCaretEvent)
    textareaScrollEl.removeEventListener('select', handleEditorCaretEvent)
    textareaScrollEl.removeEventListener('input', handleEditorCaretEvent)
  }
  
  const bindTextareaScroll = () => {
    nextTick(() => {
      const nextEl = getTextareaEl()
      if (nextEl === textareaScrollEl) {
        syncGutterScroll()
        updateCaretLineFromTextarea()
        return
      }
      removeTextareaListeners()
      textareaScrollEl = nextEl
      addTextareaListeners()
      syncGutterScroll()
      updateCaretLineFromTextarea()
    })
  }
  
  const applyTextChange = (nextText, successMessage) => {
    const tab = activeTab.value
    if (!tab) return false
  
    commitPendingInput(tab.id)
  
    const current = String(tab.text || '')
    const next = String(nextText || '')
    if (current === next) {
      ElMessage.info({ message: '文本无变化', grouping: true })
      return false
    }
  
    const history = ensureHistory(tab.id)
    boundedPush(history.undo, current)
    history.redo = []
  
    tab.text = next
    tab.updatedAt = Date.now()
  
    schedulePersist()
    bindTextareaScroll()
  
    if (successMessage) {
      ElMessage.success({ message: successMessage, grouping: true })
    }
    return true
  }
  
  const handleTextInput = (value) => {
    const tab = activeTab.value
    if (!tab) return
  
    const next = String(value ?? '')
    if (next === tab.text) return
  
    if (pendingInputBaseByTab[tab.id] === undefined) {
      pendingInputBaseByTab[tab.id] = tab.text
    }
  
    tab.text = next
    tab.updatedAt = Date.now()
    scheduleInputCommit(tab.id)
    schedulePersist()
    updateCaretLineFromTextarea()
  }
  
  const createTab = () => {
    commitPendingInput(activeTabId.value)
    const tab = createEmptyTab(createNextTabName())
    tabs.value.push(tab)
    ensureHistory(tab.id)
    activeTabId.value = tab.id
    schedulePersist()
    bindTextareaScroll()
  }

  const handleTabsEdit = (targetName, action) => {
    if (action === 'add') {
      createTab()
      return
    }
    if (action === 'remove') {
      closeTabById(targetName)
    }
  }
  
  const closeTabById = (tabId) => {
    const id = String(tabId || '')
    const idx = tabs.value.findIndex((tab) => tab.id === id)
    if (idx < 0) return
  
    if (tabs.value.length <= 1) {
      ElMessage.info({ message: '至少保留一个标签', grouping: true })
      return
    }
  
    commitPendingInput(id)
    clearInputTimer(id)
    delete pendingInputBaseByTab[id]
    delete historyByTab[id]
  
    const removingActive = activeTabId.value === id
    tabs.value.splice(idx, 1)
  
    if (removingActive) {
      const nextTab = tabs.value[idx] || tabs.value[idx - 1] || tabs.value[0]
      activeTabId.value = nextTab?.id || ''
    }
  
    schedulePersist()
    bindTextareaScroll()
  }
  
  const promptRenameTab = async (tabId) => {
    const tab = getTabById(tabId)
    if (!tab) return
    try {
      const { value } = await ElMessageBox.prompt('请输入标签名称', '重命名标签', {
        inputValue: tab.name,
        inputPlaceholder: '例如：订单清洗',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      const nextName = String(value || '').trim()
      if (!nextName) {
        ElMessage.warning({ message: '标签名称不能为空', grouping: true })
        return
      }
      tab.name = nextName
      tab.updatedAt = Date.now()
      schedulePersist()
    } catch (err) {}
  }
  
  const renameActiveTab = () => {
    promptRenameTab(activeTabId.value)
  }

  const openConfigDialog = () => {
    configDialogVisible.value = true
  }
  
  const copyText = async (text, okMsg, options = {}) => {
    const value = String(text ?? '')
    const allowEmpty = !!options.allowEmpty
    if (!value && !allowEmpty) {
      ElMessage.warning({ message: '当前没有可复制内容', grouping: true })
      return
    }
  
    try {
      await navigator.clipboard.writeText(value)
    } catch (err) {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  
    ElMessage.success({ message: okMsg || '已复制', grouping: true })
  }
  
  const copyActiveText = async () => {
    await copyText(activeText.value, '已复制当前标签全文')
  }

  const copyLineByNumber = async (lineNo) => {
    const target = Number(lineNo)
    if (!Number.isFinite(target) || target < 1) return

    const lines = splitLines(activeText.value)
    if (target > lines.length) return

    const value = String(lines[target - 1] ?? '').trim()
    const message = value ? `已复制第 ${target} 行` : `已复制第 ${target} 行（空文本）`
    await copyText(value, message, { allowEmpty: true })
  }
  
  const clearActiveText = () => {
    applyTextChange('', '已清空当前标签')
  }
  
  const removeBlankLines = () => {
    const lines = splitLines(activeText.value)
    const cleaned = lines.filter((line) => line.replace(/[\s\u3000]/g, '') !== '')
    applyTextChange(joinLines(cleaned), '已去除多余空行')
  }
  
  const trimEachLine = () => {
    const lines = splitLines(activeText.value)
    applyTextChange(joinLines(lines.map((line) => line.trim())), '已去除每行首尾空格')
  }
  
  const dedupeLines = () => {
    const lines = splitLines(activeText.value)
    const seen = new Set()
    const out = []
    for (const line of lines) {
      if (seen.has(line)) continue
      seen.add(line)
      out.push(line)
    }
    applyTextChange(joinLines(out), '已完成文本行去重')
  }
  
  const applyAffix = () => {
    const prefix = String(affixPrefix.value || '')
    const suffix = String(affixSuffix.value || '')
    const lines = splitLines(activeText.value)
    const out = lines.map((line) => `${prefix}${line}${suffix}`)
    applyTextChange(joinLines(out), '已批量添加前后缀')
  }
  
  const normalizeFlags = (input) => String(input || '').replace(/\s+/g, '')
  
  const validateFlags = (flags) => {
    const used = new Set()
    for (const char of flags) {
      if (!VALID_REGEX_FLAGS.has(char)) return `不支持的 flags: ${char}`
      if (used.has(char)) return `重复的 flags: ${char}`
      used.add(char)
    }
    return ''
  }
  
  const countRegexReplacements = (text, re) => {
    const source = String(text || '')
    if (!source) return 0
    if (!re.global) {
      const tester = new RegExp(re.source, re.flags)
      return tester.test(source) ? 1 : 0
    }
    const counter = new RegExp(re.source, re.flags)
    let count = 0
    for (const _ of source.matchAll(counter)) {
      count += 1
    }
    return count
  }

  const compileRegex = (patternInput, flagsInput) => {
    const pattern = String(patternInput || '')
    const flags = normalizeFlags(flagsInput)
    const flagError = validateFlags(flags)
    if (flagError) {
      return { regex: null, flags, error: flagError }
    }

    try {
      return { regex: new RegExp(pattern, flags), flags, error: '' }
    } catch (err) {
      return { regex: null, flags, error: `正则无效: ${err?.message || '编译失败'}` }
    }
  }

  const buildLineStartIndexes = (source) => {
    const text = String(source || '')
    const starts = [0]
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i)
      if (code === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          i += 1
        }
        starts.push(i + 1)
        continue
      }
      if (code === 10) {
        starts.push(i + 1)
      }
    }
    return starts
  }

  const getLineNoByIndex = (lineStarts, sourceIndex) => {
    if (!lineStarts.length) return 1
    const index = Math.max(0, Number.isFinite(Number(sourceIndex)) ? Number(sourceIndex) : 0)
    let low = 0
    let high = lineStarts.length - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (lineStarts[mid] <= index) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return Math.max(1, high + 1)
  }

  const advanceStringIndex = (source, index, isUnicode) => {
    if (!isUnicode) return index + 1
    const codePoint = source.codePointAt(index)
    if (!Number.isFinite(codePoint)) return index + 1
    return index + (codePoint > 0xffff ? 2 : 1)
  }

  const collectRegexMatches = (source, regex) => {
    const text = String(source || '')
    if (!text || !regex) return { matches: [], truncated: false }

    const lineStarts = buildLineStartIndexes(text)
    const runner = new RegExp(regex.source, regex.flags)
    const matches = []
    let truncated = false

    if (!runner.global) {
      const one = runner.exec(text)
      if (!one) return { matches: [], truncated: false }
      const value = String(one[0] ?? '')
      const start = Number(one.index) || 0
      const end = start + value.length
      matches.push({
        start,
        end,
        lineNo: getLineNoByIndex(lineStarts, start),
      })
      return { matches, truncated: false }
    }

    while (matches.length < MAX_REGEX_PREVIEW_MATCHES) {
      const current = runner.exec(text)
      if (!current) break
      const value = String(current[0] ?? '')
      const start = Number(current.index) || 0
      const end = start + value.length
      matches.push({
        start,
        end,
        lineNo: getLineNoByIndex(lineStarts, start),
      })

      if (value === '') {
        const nextIndex = advanceStringIndex(text, runner.lastIndex, runner.unicode)
        runner.lastIndex = nextIndex
      }
    }

    if (matches.length >= MAX_REGEX_PREVIEW_MATCHES) {
      truncated = !!runner.exec(text)
    }
    return { matches, truncated }
  }

  const resetRegexPreview = () => {
    regexMatches.value = []
    activeMatchIndex.value = -1
    regexPreviewError.value = ''
  }

  const refreshRegexPreview = ({ keepIndex = true } = {}) => {
    if (!configDialogVisible.value) {
      resetRegexPreview()
      return
    }

    regexPreviewError.value = ''
    const pattern = String(regexPattern.value || '')
    if (!pattern) {
      regexMatches.value = []
      activeMatchIndex.value = -1
      return
    }

    const { regex, error } = compileRegex(pattern, regexFlags.value)
    if (error) {
      regexPreviewError.value = error
      regexMatches.value = []
      activeMatchIndex.value = -1
      return
    }

    const { matches, truncated } = collectRegexMatches(activeText.value, regex)
    regexMatches.value = matches
    if (truncated) {
      regexPreviewError.value = `匹配过多，仅预览前 ${MAX_REGEX_PREVIEW_MATCHES} 处`
    }

    if (!matches.length) {
      activeMatchIndex.value = -1
      return
    }

    if (keepIndex && activeMatchIndex.value >= 0 && activeMatchIndex.value < matches.length) {
      return
    }

    activeMatchIndex.value = 0
  }

  const lineHeightPx = () => Math.round(clampFontSize(editorFontSize.value) * 1.56)

  const scrollLineIntoView = (lineNo) => {
    if (!textareaScrollEl) return
    const line = Math.max(1, Number(lineNo) || 1)
    const height = lineHeightPx()
    const targetTop = Math.max(0, (line - 1) * height)
    const targetBottom = targetTop + height
    const viewTop = textareaScrollEl.scrollTop
    const viewBottom = viewTop + textareaScrollEl.clientHeight
    if (targetTop < viewTop || targetBottom > viewBottom) {
      textareaScrollEl.scrollTop = Math.max(0, targetTop - height * 2)
      syncGutterScroll()
    }
  }

  const focusMatch = (index) => {
    const total = regexMatches.value.length
    if (!total) return

    const normalized = ((Number(index) || 0) % total + total) % total
    activeMatchIndex.value = normalized
    const target = regexMatches.value[normalized]
    if (!target) return

    nextTick(() => {
      const latestEl = getTextareaEl()
      if (latestEl && latestEl !== textareaScrollEl) {
        removeTextareaListeners()
        textareaScrollEl = latestEl
        addTextareaListeners()
      }
      if (!textareaScrollEl) return
      const maxLen = String(activeText.value || '').length
      const start = Math.min(Math.max(target.start, 0), maxLen)
      const end = Math.min(Math.max(target.end, start), maxLen)
      textareaScrollEl.focus()
      textareaScrollEl.setSelectionRange(start, end)
      scrollLineIntoView(target.lineNo)
      updateCaretLineFromTextarea()
    })
  }

  const focusPrevMatch = () => {
    if (!regexMatches.value.length) return
    const nextIndex = activeMatchIndex.value < 0 ? 0 : activeMatchIndex.value - 1
    focusMatch(nextIndex)
  }

  const focusNextMatch = () => {
    if (!regexMatches.value.length) return
    const nextIndex = activeMatchIndex.value < 0 ? 0 : activeMatchIndex.value + 1
    focusMatch(nextIndex)
  }
  
  const applyRegexReplace = () => {
    const pattern = String(regexPattern.value || '')
    if (!pattern) {
      ElMessage.warning({ message: '请先输入正则 pattern', grouping: true })
      return
    }
  
    const { regex: re, error } = compileRegex(pattern, regexFlags.value)
    if (error || !re) {
      ElMessage.error({ message: error || '正则无效', grouping: true })
      return
    }
  
    const source = activeText.value
    const hits = countRegexReplacements(source, re)
    if (!hits) {
      ElMessage.info({ message: '未匹配到可替换内容', grouping: true })
      return
    }
  
    const replacement = String(regexReplacement.value || '')
    const out = source.replace(re, replacement)
    applyTextChange(out, `正则替换完成，处理 ${hits} 处`)
    refreshRegexPreview({ keepIndex: false })
  }
  
  const undo = () => {
    const tab = activeTab.value
    if (!tab) return
  
    commitPendingInput(tab.id)
    const history = ensureHistory(tab.id)
    if (!history.undo.length) return
  
    const previous = history.undo.pop()
    boundedPush(history.redo, tab.text)
    tab.text = previous
    tab.updatedAt = Date.now()
    schedulePersist()
    bindTextareaScroll()
  }
  
  const redo = () => {
    const tab = activeTab.value
    if (!tab) return
  
    commitPendingInput(tab.id)
    const history = ensureHistory(tab.id)
    if (!history.redo.length) return
  
    const next = history.redo.pop()
    boundedPush(history.undo, tab.text)
    tab.text = next
    tab.updatedAt = Date.now()
    schedulePersist()
    bindTextareaScroll()
  }
  
  const handleKeydown = (event) => {
    if (!(event.ctrlKey || event.metaKey)) return
  
    const key = String(event.key || '').toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
      return
    }
  
    if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault()
      redo()
    }
  }
  
  restoreState()
  
  watch(
    [tabs, activeTabId, regexPattern, regexReplacement, regexFlags, affixPrefix, affixSuffix, editorFontSize],
    () => {
      editorFontSize.value = clampFontSize(editorFontSize.value)
      schedulePersist()
    },
    { deep: true }
  )
  
  watch(activeTabId, (nextId, prevId) => {
    if (prevId) commitPendingInput(prevId)
    if (nextId && !getTabById(nextId) && tabs.value[0]) {
      activeTabId.value = tabs.value[0].id
      return
    }
    bindTextareaScroll()
  })

  watch(configDialogVisible, () => {
    refreshRegexPreview({ keepIndex: false })
  })

  watch([regexPattern, regexFlags], () => {
    refreshRegexPreview({ keepIndex: false })
  })
  
  watch(
    () => activeText.value,
    () => {
      bindTextareaScroll()
      refreshRegexPreview({ keepIndex: true })
    }
  )
  
  onMounted(() => {
    bindTextareaScroll()
    window.addEventListener('keydown', handleKeydown)
  })
  
  onBeforeUnmount(() => {
    commitPendingInput(activeTabId.value)
    inputTimerByTab.forEach((timer) => clearTimeout(timer))
    inputTimerByTab.clear()
  
    removeTextareaListeners()
    textareaScrollEl = null
  
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    persistState()
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    tabs,
    activeTabId,
    activeTab,
    activeText,
    activeLineCount,
    activeCaretLine,
    lineNumbers,
    canUndo,
    canRedo,
    editorFontSize,
    editorStyleVars,
    configDialogVisible,
    regexPattern,
    regexReplacement,
    regexFlags,
    regexPreviewError,
    regexMatchCount,
    activeMatchIndex,
    activeMatchIndexLabel,
    matchedLineSet,
    affixPrefix,
    affixSuffix,
    editorRef,
    gutterRef,
    countLines,
    handleTextInput,
    handleEditorCaretEvent,
    createTab,
    handleTabsEdit,
    closeTabById,
    promptRenameTab,
    renameActiveTab,
    openConfigDialog,
    copyActiveText,
    copyLineByNumber,
    clearActiveText,
    removeBlankLines,
    trimEachLine,
    dedupeLines,
    applyAffix,
    applyRegexReplace,
    focusPrevMatch,
    focusNextMatch,
    undo,
    redo,
  }
}
