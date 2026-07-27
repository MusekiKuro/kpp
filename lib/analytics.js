const EVENT_NAMES = new Set([
  'category_view',
  'search',
  'product_view',
  'add_to_request',
  'request_form_open',
  'request_submit',
  'contact_cta',
  'import_batch_completed',
  'import_batch_failed',
])

const ALLOWED_PROPERTIES = new Set([
  'locale',
  'category_slug',
  'product_slug',
  'has_query',
  'result_count',
  'outcome',
  'channel',
])

function sanitizeProperties(properties) {
  return Object.fromEntries(Object.entries(properties || {}).filter(([key, value]) => (
    ALLOWED_PROPERTIES.has(key) && (
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.length <= 120 && !/[\r\n@]/.test(value))
    )
  )))
}

export function trackEvent(name, properties = {}) {
  if (!EVENT_NAMES.has(name)) return false

  const detail = { name, properties: sanitizeProperties(properties) }
  if (typeof window === 'undefined') return false

  // An owner-selected analytics integration may subscribe to this hook later.
  window.dispatchEvent(new CustomEvent('nurset:analytics', { detail }))
  return true
}
