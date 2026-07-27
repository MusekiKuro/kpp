const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const URL_RE = /^https?:\/\//i

export const MAX_JSON_BODY_BYTES = 32 * 1024
export const MAX_ORDER_ITEMS = 50
export const MAX_QUANTITY = 99
export const MAX_QUOTE_ITEMS = 50
export const MAX_QUOTE_COMMENT_LENGTH = 4000
export const QUOTE_STATUSES = Object.freeze(['new', 'contacted', 'in_progress', 'closed', 'rejected'])
export const LEGACY_PRODUCT_FIELDS = Object.freeze([
  'name',
  'category',
  'description',
  'image_url',
  'sort_order',
])

export class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = status
  }
}

export function isUUID(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export async function readJsonBody(request, maxBytes = MAX_JSON_BODY_BYTES) {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestValidationError('Request body is too large', 413)
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new RequestValidationError('Request body is too large', 413)
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new RequestValidationError('Request body must be valid JSON')
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(value, field, { required = false, max = 1000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new RequestValidationError(`${field} is required`)
    return undefined
  }
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${field} must be a string`)
  }
  const normalized = value.trim()
  if (required && !normalized) throw new RequestValidationError(`${field} is required`)
  if (normalized.length > max) throw new RequestValidationError(`${field} is too long`)
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new RequestValidationError(`${field} contains unsupported characters`)
  }
  return normalized
}

export function validateOrderPayload(body) {
  if (!isPlainObject(body)) throw new RequestValidationError('Request body must be an object')

  const customer_name = readString(body.customer_name, 'customer_name', { required: true, max: 120 })
  const customer_phone = readString(body.customer_phone, 'customer_phone', { required: true, max: 32 })
  const customer_message = readString(body.customer_message, 'customer_message', { max: 2000 }) || ''

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ORDER_ITEMS) {
    throw new RequestValidationError(`items must contain between 1 and ${MAX_ORDER_ITEMS} items`)
  }

  const items = body.items.map((item) => {
    if (!isPlainObject(item)) throw new RequestValidationError('Each item must be an object')
    const keys = Object.keys(item).sort()
    if (keys.length !== 2 || keys[0] !== 'product_id' || keys[1] !== 'quantity') {
      throw new RequestValidationError('Each item may contain only product_id and quantity')
    }
    if (!isUUID(item.product_id)) throw new RequestValidationError('product_id must be a UUID')
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new RequestValidationError(`quantity must be an integer between 1 and ${MAX_QUANTITY}`)
    }
    return { product_id: item.product_id, quantity: item.quantity }
  })

  return { customer_name, customer_phone, customer_message, items }
}

const QUOTE_FIELDS = Object.freeze([
  'bin',
  'city',
  'consent_personal_data',
  'customer_email',
  'customer_message',
  'customer_name',
  'customer_phone',
  'idempotency_key',
  'items',
  'locale',
  'organization',
  'source_url',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
])

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{16,128}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UTM_RE = /^[A-Za-z0-9._~%+-]+$/

function assertExactFields(value, allowed, field) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) throw new RequestValidationError(`${field} contains unsupported fields`)
}

function readOptionalQuoteString(body, field, max) {
  return readString(body[field], field, { max }) || null
}

function readOptionalUtm(body, field) {
  const value = readOptionalQuoteString(body, field, 120)
  if (value && !UTM_RE.test(value)) throw new RequestValidationError(`${field} contains unsupported characters`)
  return value
}

export function validateQuoteRequestPayload(body) {
  if (!isPlainObject(body)) throw new RequestValidationError('Request body must be an object')
  assertExactFields(body, QUOTE_FIELDS, 'Request')

  const customer_name = readString(body.customer_name, 'customer_name', { required: true, max: 120 })
  const customer_phone = readString(body.customer_phone, 'customer_phone', { required: true, max: 32 })
  const phoneDigits = customer_phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw new RequestValidationError('customer_phone must contain between 10 and 15 digits')
  }

  const customer_email = readOptionalQuoteString(body, 'customer_email', 254)
  if (customer_email && !EMAIL_RE.test(customer_email)) throw new RequestValidationError('customer_email is invalid')

  const locale = body.locale
  if (locale !== 'ru' && locale !== 'kk') throw new RequestValidationError('locale must be ru or kk')
  if (body.consent_personal_data !== true) throw new RequestValidationError('consent_personal_data is required')

  const idempotency_key = readString(body.idempotency_key, 'idempotency_key', { required: true, max: 128 })
  if (!IDEMPOTENCY_KEY_RE.test(idempotency_key)) throw new RequestValidationError('idempotency_key is invalid')

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_QUOTE_ITEMS) {
    throw new RequestValidationError(`items must contain between 1 and ${MAX_QUOTE_ITEMS} items`)
  }

  const seen = new Set()
  const items = body.items.map((item) => {
    if (!isPlainObject(item)) throw new RequestValidationError('Each item must be an object')
    const keys = Object.keys(item).sort()
    if (keys.length !== 2 || keys[0] !== 'product_id' || keys[1] !== 'quantity') {
      throw new RequestValidationError('Each item may contain only product_id and quantity')
    }
    if (!isUUID(item.product_id)) throw new RequestValidationError('product_id must be a UUID')
    if (seen.has(item.product_id)) throw new RequestValidationError('items must not contain duplicate product_id values')
    seen.add(item.product_id)
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new RequestValidationError(`quantity must be an integer between 1 and ${MAX_QUANTITY}`)
    }
    return { product_id: item.product_id, quantity: item.quantity }
  })

  const bin = readOptionalQuoteString(body, 'bin', 12)
  if (bin && !/^\d{12}$/.test(bin)) throw new RequestValidationError('bin must contain 12 digits')
  const source_url = readOptionalQuoteString(body, 'source_url', 2048)
  if (source_url && !URL_RE.test(source_url)) throw new RequestValidationError('source_url must be an http(s) URL')

  return {
    customer_name,
    customer_phone,
    customer_email,
    organization: readOptionalQuoteString(body, 'organization', 200),
    bin,
    city: readOptionalQuoteString(body, 'city', 120),
    customer_message: readOptionalQuoteString(body, 'customer_message', MAX_QUOTE_COMMENT_LENGTH),
    locale,
    consent_personal_data: body.consent_personal_data,
    source_url,
    utm_source: readOptionalUtm(body, 'utm_source'),
    utm_medium: readOptionalUtm(body, 'utm_medium'),
    utm_campaign: readOptionalUtm(body, 'utm_campaign'),
    utm_term: readOptionalUtm(body, 'utm_term'),
    utm_content: readOptionalUtm(body, 'utm_content'),
    idempotency_key,
    items,
  }
}

// Temporary compatibility validator for the pre-domain products API. New product
// contracts must use lib/domain-contracts.mjs instead of expanding this allowlist.
export function validateLegacyProductPayload(body, { partial = false } = {}) {
  if (!isPlainObject(body)) throw new RequestValidationError('Request body must be an object')

  const allowedFields = new Set(LEGACY_PRODUCT_FIELDS)
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new RequestValidationError('Unknown product field')
  }

  const updates = {}
  if (!partial || body.name !== undefined) {
    updates.name = readString(body.name, 'name', { required: true, max: 200 })
  }
  if (!partial || body.category !== undefined) {
    updates.category = readString(body.category, 'category', { required: true, max: 100 })
  }
  if (body.description !== undefined) {
    updates.description = body.description === null
      ? null
      : readString(body.description, 'description', { max: 10000 })
  }
  if (body.image_url !== undefined) {
    if (body.image_url !== null && (typeof body.image_url !== 'string' || body.image_url.length > 2048 || !URL_RE.test(body.image_url))) {
      throw new RequestValidationError('image_url must be an http(s) URL or null')
    }
    updates.image_url = body.image_url
  }
  if (body.sort_order !== undefined) {
    if (!Number.isSafeInteger(body.sort_order) || body.sort_order < 0 || body.sort_order > 100000) {
      throw new RequestValidationError('sort_order must be a non-negative integer')
    }
    updates.sort_order = body.sort_order
  }

  if (partial && Object.keys(updates).length === 0) {
    throw new RequestValidationError('At least one product field is required')
  }
  return updates
}

export const validateProductPayload = validateLegacyProductPayload

export function validateOrderUpdate(body, statuses) {
  if (!isPlainObject(body) || !isUUID(body.id) || typeof body.status !== 'string' || !statuses.includes(body.status)) {
    throw new RequestValidationError('id and a valid status are required')
  }
  return { id: body.id, status: body.status }
}

export function validateQuoteAdminUpdate(body) {
  if (!isPlainObject(body) || !isUUID(body.id)) {
    throw new RequestValidationError('id is required')
  }
  assertExactFields(body, ['id', 'status', 'internal_comment'], 'Request')
  const status = body.status
  if (status !== undefined && !QUOTE_STATUSES.includes(status)) {
    throw new RequestValidationError('status is invalid')
  }
  const internal_comment = body.internal_comment === undefined
    ? undefined
    : readString(body.internal_comment, 'internal_comment', { max: 4000 }) || null
  if (status === undefined && internal_comment === undefined) {
    throw new RequestValidationError('status or internal_comment is required')
  }
  return { id: body.id, status, internal_comment }
}

export function validateUUIDBody(body) {
  if (!isPlainObject(body) || !isUUID(body.id)) {
    throw new RequestValidationError('id must be a UUID')
  }
  return body.id
}

const rateLimitBuckets = new Map()

export function checkRateLimit(request, { limit = 10, windowMs = 60_000, scope = 'orders' } = {}) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = (forwardedFor || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
  const key = `${ip}:${scope}`
  const now = Date.now()
  const existing = rateLimitBuckets.get(key)

  if (!existing || now - existing.startedAt >= windowMs) {
    rateLimitBuckets.set(key, { startedAt: now, count: 1 })
    return { allowed: true }
  }

  existing.count += 1
  return {
    allowed: existing.count <= limit,
    retryAfter: Math.ceil((windowMs - (now - existing.startedAt)) / 1000),
  }
}
