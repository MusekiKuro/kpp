const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ATTRIBUTE_CODE_RE = /^[a-z0-9][a-z0-9_]*$/
const SEARCH_RE = /^[\p{L}\p{N} ._-]+$/u
const INTEGER_RE = /^[1-9]\d*$/
const MONEY_RE = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 24
export const MAX_PAGE = 100000
export const MAX_PAGE_SIZE = 96
export const MAX_SEARCH_LENGTH = 100
export const MAX_ATTRIBUTE_VALUE_LENGTH = 120
export const MAX_ATTRIBUTE_FILTERS = 20

export const CATALOG_SORTS = Object.freeze([
  'recommended',
  'name_asc',
  'newest',
  'price_asc',
  'price_desc',
])

export class CatalogQueryValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`)
    this.name = 'CatalogQueryValidationError'
    this.code = 'INVALID_CATALOG_QUERY'
    this.path = path
    this.status = 400
  }
}

function fail(path, message) {
  throw new CatalogQueryValidationError(path, message)
}

function toSearchParams(input) {
  if (input instanceof URLSearchParams) return new URLSearchParams(input)
  if (typeof input === 'string') return new URLSearchParams(input.replace(/^\?/, ''))
  if (input && input.searchParams instanceof URLSearchParams) {
    return new URLSearchParams(input.searchParams)
  }

  const params = new URLSearchParams()
  if (input && typeof input === 'object') {
    for (const [key, rawValue] of Object.entries(input)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      for (const value of values) {
        if (value !== undefined && value !== null) params.append(key, String(value))
      }
    }
  }
  return params
}

function readSingle(params, key) {
  const values = params.getAll(key)
  if (values.length > 1) fail(key, 'must be provided once')
  return values[0] ?? null
}

function readOptionalText(params, key, { max, pattern } = {}) {
  const value = readSingle(params, key)
  if (value === null || value.trim() === '') return null

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length > max) fail(key, `must be at most ${max} characters`)
  if (pattern && !pattern.test(normalized)) fail(key, 'contains unsupported characters')
  return normalized
}

function readEnum(params, key, values) {
  const value = readSingle(params, key)
  if (value === null || value === '') return null
  if (!values.includes(value)) fail(key, `must be one of: ${values.join(', ')}`)
  return value
}

function readSlug(params, key) {
  const value = readOptionalText(params, key, { max: 120 })
  if (value === null) return null
  if (!SLUG_RE.test(value)) fail(key, 'must be a lowercase ASCII slug')
  return value
}

function readInteger(params, key, { defaultValue, max }) {
  const value = readSingle(params, key)
  if (value === null || value === '') return defaultValue
  if (!INTEGER_RE.test(value)) fail(key, 'must be a positive integer')

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > max) fail(key, `must be at most ${max}`)
  return parsed
}

function readMoney(params, key) {
  const value = readSingle(params, key)
  if (value === null || value === '') return null
  if (!MONEY_RE.test(value)) fail(key, 'must be a non-negative amount with at most two decimals')

  const parsed = Number(value)
  if (!Number.isSafeInteger(Math.round(parsed * 100)) || parsed > 999999999999.99) {
    fail(key, 'is outside the supported price range')
  }
  return parsed
}

function readAttributeFilters(params) {
  const attributes = {}

  for (const key of new Set(params.keys())) {
    if (!key.startsWith('attr.')) continue

    const code = key.slice('attr.'.length)
    if (!ATTRIBUTE_CODE_RE.test(code) || code.length > 64) {
      fail(key, 'must use a valid filterable attribute code')
    }

    const value = readSingle(params, key)
    if (value === null || value.trim() === '') fail(key, 'must not be empty')
    const normalized = value.trim()
    if (normalized.length > MAX_ATTRIBUTE_VALUE_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
      fail(key, `must be at most ${MAX_ATTRIBUTE_VALUE_LENGTH} characters`)
    }
    attributes[code] = normalized
  }

  if (Object.keys(attributes).length > MAX_ATTRIBUTE_FILTERS) {
    fail('attributes', `must contain at most ${MAX_ATTRIBUTE_FILTERS} filters`)
  }

  return attributes
}

export function validateCatalogSlug(value, path = 'slug') {
  if (typeof value !== 'string' || value.length > 120 || !SLUG_RE.test(value)) {
    fail(path, 'must be a lowercase ASCII slug')
  }
  return value
}

export function parseCatalogQuery(input) {
  const params = toSearchParams(input)
  const allowedKeys = new Set([
    'q',
    'category',
    'brand',
    'stock',
    'price_mode',
    'min_price',
    'max_price',
    'sort',
    'page',
    'page_size',
  ])

  for (const key of new Set(params.keys())) {
    if (!allowedKeys.has(key) && !key.startsWith('attr.')) {
      fail(key, 'is not a supported catalog parameter')
    }
  }

  const q = readOptionalText(params, 'q', { max: MAX_SEARCH_LENGTH, pattern: SEARCH_RE })
  const category = readSlug(params, 'category')
  const brand = readSlug(params, 'brand')
  const stock = readEnum(params, 'stock', ['unknown', 'in_stock', 'on_order', 'out_of_stock'])
  const priceMode = readEnum(params, 'price_mode', ['request', 'exact', 'from', 'hidden'])
  const minPrice = readMoney(params, 'min_price')
  const maxPrice = readMoney(params, 'max_price')
  const sort = readEnum(params, 'sort', CATALOG_SORTS) || 'recommended'
  const page = readInteger(params, 'page', { defaultValue: DEFAULT_PAGE, max: MAX_PAGE })
  const pageSize = readInteger(params, 'page_size', { defaultValue: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE })
  const attributes = readAttributeFilters(params)

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    fail('min_price', 'must be less than or equal to max_price')
  }

  return Object.freeze({
    q,
    category,
    brand,
    stock,
    price_mode: priceMode,
    min_price: minPrice,
    max_price: maxPrice,
    sort,
    page,
    page_size: pageSize,
    attributes: Object.freeze(attributes),
  })
}

export function catalogQueryKey(query) {
  return JSON.stringify({
    q: query.q,
    category: query.category,
    brand: query.brand,
    stock: query.stock,
    price_mode: query.price_mode,
    min_price: query.min_price,
    max_price: query.max_price,
    sort: query.sort,
    page: query.page,
    page_size: query.page_size,
    attributes: Object.fromEntries(Object.entries(query.attributes).sort(([a], [b]) => a.localeCompare(b))),
  })
}
