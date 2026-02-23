import { ElMessage } from 'element-plus'
import { parseAccountBatch } from '../../../utils/accountParser'
import { createEmptyParseProfile } from './constants'

export function useAccountParse({
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
  lastProfileKey,
}) {
  const parseInMainThread = () => parseAccountBatch(rawInput.value, getParseOptions())

  const parseWithWorker = () =>
    new Promise((resolve, reject) => {
      if (!parseWorker.value) {
        parseWorker.value = new Worker(new URL('../../../workers/accountParser.worker.js', import.meta.url), {
          type: 'module',
        })
      }

      const handleMessage = (event) => {
        if (event?.data?.type !== 'result') return
        parseWorker.value?.removeEventListener('message', handleMessage)
        parseWorker.value?.removeEventListener('error', handleError)
        resolve(event.data.result)
      }

      const handleError = (err) => {
        parseWorker.value?.removeEventListener('message', handleMessage)
        parseWorker.value?.removeEventListener('error', handleError)
        reject(err)
      }

      parseWorker.value.addEventListener('message', handleMessage)
      parseWorker.value.addEventListener('error', handleError)
      parseWorker.value.postMessage({
        type: 'parse',
        rawInput: rawInput.value,
        options: getParseOptions(),
      })
    })

  const runParse = async ({ silentEmpty = true } = {}) => {
    const lines = String(rawInput.value || '')
      .split(/\r?\n/)
      .filter((line) => String(line || '').trim())

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
      parseProfile.value = result.profile || createEmptyParseProfile()
      stats.value = result.stats || { total: lines.length, success: 0, failed: 0 }

      localStorage.setItem(lastProfileKey, JSON.stringify(parseProfile.value))
    } catch (err) {
      console.error('[AccountFormatter] parse failed', err)
    } finally {
      if (requestId === parseSeq.value) parsing.value = false
    }
  }

  return {
    runParse,
    parseInMainThread,
    parseWithWorker,
  }
}
