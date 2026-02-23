import { computed, ref, watch } from 'vue'
import { generateCurrentOtpPayload } from '../../../utils/totp'
import {
  OTP_PHASE_DANGER_THRESHOLD,
  OTP_PHASE_FLOW_THRESHOLD,
  OTP_POINTER_DEFAULT,
  OTP_SLEEP_MS,
} from './constants'

const OTP_VISUAL_DEFAULT = Object.freeze({
  hovering: false,
  pointerX: OTP_POINTER_DEFAULT,
  pointerY: OTP_POINTER_DEFAULT,
})

export function useAccountOtp({
  tableRows,
  selectedRowIndex,
  selectedColKey,
  lastPickedLabel,
  roleLabelForKey,
  copyText,
}) {
  const otpStateByRow = ref({})
  const otpVisualByRow = ref({})
  const otpTicker = ref(null)
  const otpTicking = ref(false)

  const clamp01 = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return 0
    return Math.max(0, Math.min(1, num))
  }

  const rowOtpKey = (row, rowIndex) => {
    const sourceLine = Number(row?.meta?.sourceLine)
    return Number.isFinite(sourceLine) && sourceLine > 0 ? `line_${sourceLine}` : `row_${rowIndex}`
  }

  const getOtpState = (row, rowIndex) => otpStateByRow.value[rowOtpKey(row, rowIndex)] || null
  const isOtpSleeping = (row, rowIndex) => !!getOtpState(row, rowIndex)?.sleeping

  const getOtpVisualStateByKey = (rowKey) => otpVisualByRow.value[rowKey] || OTP_VISUAL_DEFAULT
  const getOtpVisual = (row, rowIndex) => getOtpVisualStateByKey(rowOtpKey(row, rowIndex))

  const setOtpVisualState = (rowKey, patch) => {
    const current = getOtpVisualStateByKey(rowKey)
    otpVisualByRow.value = {
      ...otpVisualByRow.value,
      [rowKey]: { ...current, ...patch },
    }
  }

  const otpProgressRatio = (state) => {
    const remaining = Number(state?.remaining || 0)
    const period = Number(state?.period || 0)
    if (!state?.code || state?.sleeping || !period) return 0
    return clamp01(remaining / period)
  }

  const otpPhase = (state) => {
    if (!state?.code || state?.sleeping) return 'idle'
    const sec = Number(state.remaining || 0)
    if (sec <= OTP_PHASE_DANGER_THRESHOLD) return 'danger'
    if (sec <= OTP_PHASE_FLOW_THRESHOLD) return 'flow'
    return 'safe'
  }

  const otpPhaseClass = (row, rowIndex) => `account-otp--${otpPhase(getOtpState(row, rowIndex))}`
  const otpHasCode = (state) => !!state?.code && !state?.sleeping
  const otpDisplayCode = (state) => (otpHasCode(state) ? String(state.code) : '')
  const otpCountdownText = (state) => {
    if (otpHasCode(state)) return `${Number(state.remaining || 0)}s`
    if (state?.sleeping) return '待机'
    return '点击'
  }
  const isOtpHovering = (row, rowIndex) => !!getOtpVisual(row, rowIndex)?.hovering

  const otpProgressPercent = (state) => Math.round(otpProgressRatio(state) * 100)
  const otpProgressColor = (state) => {
    const phase = otpPhase(state)
    if (phase === 'safe') return 'var(--account-otp-ring-safe)'
    if (phase === 'flow') return 'var(--account-otp-ring-flow)'
    if (phase === 'danger') return 'var(--account-otp-ring-danger)'
    return 'var(--account-otp-ring-idle)'
  }

  const otpGlowScale = (state) => {
    if (!state?.code || state?.sleeping) return 0.78
    const sec = Number(state.remaining || 0)
    if (sec <= OTP_PHASE_DANGER_THRESHOLD) return 0.64
    if (sec <= OTP_PHASE_FLOW_THRESHOLD) {
      const t = clamp01(
        (sec - OTP_PHASE_DANGER_THRESHOLD) / (OTP_PHASE_FLOW_THRESHOLD - OTP_PHASE_DANGER_THRESHOLD),
      )
      return 0.72 + t * 0.28
    }
    return 1
  }

  const otpCellStyle = (row, rowIndex) => {
    const state = getOtpState(row, rowIndex)
    const visual = getOtpVisual(row, rowIndex)
    const progress = otpProgressRatio(state)
    const pointerX = Math.round(clamp01(visual.pointerX) * 1000) / 10
    const pointerY = Math.round(clamp01(visual.pointerY) * 1000) / 10
    return {
      '--otp-progress': progress.toFixed(4),
      '--otp-progress-inv': (1 - progress).toFixed(4),
      '--otp-glow-scale': otpGlowScale(state).toFixed(4),
      '--otp-pointer-x': `${pointerX}%`,
      '--otp-pointer-y': `${pointerY}%`,
    }
  }

  const setOtpState = (rowKey, nextState) => {
    otpStateByRow.value = { ...otpStateByRow.value, [rowKey]: nextState }
  }

  const updateOtpPointerFromEvent = (rowKey, event, hovering) => {
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    if (!rect) {
      setOtpVisualState(rowKey, { hovering: !!hovering })
      return
    }
    const width = Math.max(Number(rect.width || 0), 1)
    const height = Math.max(Number(rect.height || 0), 1)
    const x = clamp01((Number(event?.clientX || rect.left + width / 2) - rect.left) / width)
    const y = clamp01((Number(event?.clientY || rect.top + height / 2) - rect.top) / height)
    setOtpVisualState(rowKey, { hovering: !!hovering, pointerX: x, pointerY: y })
  }

  const onOtpPointerEnter = (row, rowIndex, event) => {
    updateOtpPointerFromEvent(rowOtpKey(row, rowIndex), event, true)
  }

  const onOtpPointerMove = (row, rowIndex, event) => {
    updateOtpPointerFromEvent(rowOtpKey(row, rowIndex), event, true)
  }

  const onOtpPointerLeave = (row, rowIndex) => {
    setOtpVisualState(rowOtpKey(row, rowIndex), {
      hovering: false,
      pointerX: OTP_POINTER_DEFAULT,
      pointerY: OTP_POINTER_DEFAULT,
    })
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

  const onOtpCellClick = async (row, rowIndex) => {
    selectedRowIndex.value = rowIndex
    selectedColKey.value = '__otp_code__'
    const activated = await activateOtpRow(row, rowIndex)
    if (activated) return
    return copyText(row?.twofa, '2FA格式无效，已复制原值')
  }

  const onTableCellClick = async (row, colKey, rowIndex) => {
    selectedRowIndex.value = rowIndex
    selectedColKey.value = colKey
    if (colKey === '__otp_code__') return onOtpCellClick(row, rowIndex)

    lastPickedLabel.value = `刚复制：第 ${rowIndex + 1} 行 · ${roleLabelForKey(colKey)}`
    const raw = row?.[colKey]
    return copyText(raw, colKey === 'twofa' ? '已复制2FA原值' : `已复制${roleLabelForKey(colKey)}`)
  }

  const rowClassName = ({ rowIndex }) => (rowIndex === selectedRowIndex.value ? 'account-row-selected' : '')

  const resetOtpState = () => {
    otpStateByRow.value = {}
    otpVisualByRow.value = {}
    stopOtpTicker()
  }

  watch(
    tableRows,
    (rows) => {
      const keys = new Set(rows.map((row, idx) => rowOtpKey(row, idx)))

      const nextState = {}
      Object.entries(otpStateByRow.value).forEach(([key, value]) => {
        if (keys.has(key)) nextState[key] = value
      })
      otpStateByRow.value = nextState

      const nextVisual = {}
      Object.entries(otpVisualByRow.value).forEach(([key, value]) => {
        if (keys.has(key)) nextVisual[key] = value
      })
      otpVisualByRow.value = nextVisual

      ensureOtpTicker()
    },
    { deep: true },
  )

  return {
    otpStateByRow,
    otpVisualByRow,
    otpTicker,
    otpTicking,
    rowOtpKey,
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
    ensureOtpTicker,
    resetOtpState,
  }
}
