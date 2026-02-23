export const LAST_PROFILE_KEY = 'account_formatter_v2_last_profile'
export const ROLE_REGISTRY_KEY = 'account_formatter_v3_role_registry'
export const CUSTOM_ROLE_KEY = 'account_formatter_v3_custom_roles'
export const FIELD_ORDER_KEY = 'account_formatter_v3_field_order'
export const COLUMN_TRIM_RULES_KEY = 'account_formatter_v3_column_trim_rules'

export const DEFAULT_DELIMITER = '----'

export const BUILTIN_ROLE_REGISTRY = [
  { key: 'ignore', label: '忽略', builtin: true },
  { key: 'account', label: '账号', builtin: true },
  { key: 'password', label: '密码', builtin: true },
  { key: 'twofa', label: '2FA', builtin: true },
  { key: 'token', label: 'Token', builtin: true },
  { key: 'recovery_email', label: '辅助邮箱', builtin: true },
  { key: 'recovery_email_password', label: '邮箱密码', builtin: true },
  { key: 'cookie', label: 'Cookie', builtin: true },
]

export const DEFAULT_FIELD_ORDER = [
  'account',
  'password',
  'twofa',
  'recovery_email',
  'recovery_email_password',
  'token',
  'cookie',
  'ignore',
]

export const builtinColumns = {
  account: { key: 'account', label: '账号', minWidth: 180 },
  password: { key: 'password', label: '密码', minWidth: 160 },
  twofa: { key: 'twofa', label: '2FA', minWidth: 180 },
  token: { key: 'token', label: 'Token', minWidth: 180 },
  recovery_email: { key: 'recovery_email', label: '辅助邮箱', minWidth: 180 },
  recovery_email_password: { key: 'recovery_email_password', label: '辅助邮箱密码', minWidth: 180 },
  cookie: { key: 'cookie', label: 'Cookie', minWidth: 220 },
}

export const OTP_POINTER_DEFAULT = 0.5
export const OTP_SLEEP_MS = 90 * 1000
export const OTP_PHASE_FLOW_THRESHOLD = 16
export const OTP_PHASE_DANGER_THRESHOLD = 8

export const createEmptyParseProfile = () => ({
  delimiterMode: 'fixed',
  delimiter: '',
  confidence: 0,
  candidates: [],
  warnings: [],
})
