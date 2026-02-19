import { parseAccountBatch } from '../utils/accountParser'

self.onmessage = (event) => {
  const payload = event?.data || {}
  if (payload.type !== 'parse') return

  const result = parseAccountBatch(payload.rawInput, payload.options || {})
  self.postMessage({ type: 'result', result })
}
