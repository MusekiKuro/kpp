const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const URL_RE = /^https?:\/\//i
const MAX_MONEY_AMOUNT = 999999999999.99

export const LOCALES = Object.freeze(['ru', 'kk'])
export const PRICE_MODES = Object.freeze(['request', 'exact', 'from', 'hidden'])
export const CURRENCY = 'KZT'
export const STOCK_STATUSES = Object.freeze(['unknown', 'in_stock', 'on_order', 'out_of_stock'])
export const PUBLICATION_STATUSES = Object.freeze(['draft', 'published', 'archived'])
// `verified` is the human-reviewed state required before publishing Kazakh content.
export const TRANSLATION_STATUSES = Object.freeze(['missing', 'ai_draft', 'verified'])
export const IMPORT_BATCH_STATUSES = Object.freeze([
  'uploaded',
  'parsed',
  'needs_review',
  'approved',
  'applying',
  'completed',
  'failed',
  'cancelled',
])
export const IMPORT_ACTIONS = Object.freeze(['create', 'update', 'skip', 'error'])
export const SOURCE_TYPES = Object.freeze(['xlsx', 'csv', 'json', 'text_agent'])

export const PUBLIC_PRODUCT_DTO_FIELDS = Object.freeze([
  'id',
  'slug',
  'sku',
  'locale',
  'name',
  'short_description',
  'description',
  'category_slug',
  'brand_slug',
  'price',
  'stock_status',
  'image_url',
])

export const ADMIN_PRODUCT_DTO_FIELDS = Object.freeze([
  'id',
  'slug',
  'sku',
  'external_id',
  'category_slug',
  'brand_slug',
  'name_ru',
  'name_kk',
  'short_description_ru',
  'short_description_kk',
  'description_ru',
  'description_kk',
  'price',
  'stock_status',
  'publication_status',
  'publish_ru',
  'publish_kk',
  'translation_status_kk',
  'is_featured',
  'source_type',
  'source_reference',
  'source_hash',
])

export const IMPORT_PRODUCT_ROW_FIELDS = Object.freeze([
  'source_type',
  'source_reference',
  'source_hash',
  'external_id',
  'sku',
  'slug',
  'category_slug',
  'brand_slug',
  'name_ru',
  'name_kk',
  'short_description_ru',
  'short_description_kk',
  'description_ru',
  'description_kk',
  'price_mode',
  'price_amount',
  'old_price_amount',
  'currency',
  'stock_status',
  'publication_status',
  'publish_ru',
  'publish_kk',
  'translation_status_kk',
  'is_featured',
  'image_url',
])

export class DomainValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`)
    this.name = 'DomainValidationError'
    this.path = path
  }
}

function fail(path, message) {
  throw new DomainValidationError(path, message)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) fail(path, 'must be an object')
}

function assertExactKeys(value, fields, required, path) {
  const allowed = new Set(fields)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown field')
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${path}.${key}`, 'is required')
  }
}

function assertEnum(value, values, path) {
  if (!values.includes(value)) fail(path, `must be one of: ${values.join(', ')}`)
  return value
}

function validateText(value, path, { nullable = false, max = 10000 } = {}) {
  if (value === null && nullable) return null
  if (typeof value !== 'string') fail(path, 'must be a string')
  const normalized = value.trim()
  if (!normalized) fail(path, 'must not be empty')
  if (normalized.length > max) fail(path, `must be at most ${max} characters`)
  return normalized
}

function validateNullableText(value, path, options = {}) {
  return validateText(value, path, { ...options, nullable: true })
}

function validateBoolean(value, path) {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

function validateNullableUrl(value, path) {
  if (value === null) return null
  const normalized = validateText(value, path, { max: 2048 })
  if (!URL_RE.test(normalized)) fail(path, 'must be an http(s) URL or null')
  return normalized
}

function validateNullableEnum(value, values, path) {
  if (value === null) return null
  return assertEnum(value, values, path)
}

export function isUUID(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function validateUUID(value, path = 'id') {
  if (!isUUID(value)) fail(path, 'must be a UUID')
  return value
}

export function validateLocale(value, path = 'locale') {
  return assertEnum(value, LOCALES, path)
}

export function validateSlug(value, path = 'slug') {
  const normalized = validateText(value, path, { max: 120 })
  if (!SLUG_RE.test(normalized)) {
    fail(path, 'must contain lowercase ASCII letters, digits, and single hyphens only')
  }
  return normalized
}

export function validateNullableSlug(value, path = 'slug') {
  if (value === null) return null
  return validateSlug(value, path)
}

export function validateSku(value, path = 'sku') {
  const normalized = validateText(value, path, { max: 64 })
  if (!SKU_RE.test(normalized)) {
    fail(path, 'must use letters, digits, dot, underscore, or hyphen without spaces')
  }
  return normalized
}

export function validateNullableSku(value, path = 'sku') {
  if (value === null) return null
  return validateSku(value, path)
}

function validateMoneyAmount(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (value <= 0 || value > MAX_MONEY_AMOUNT) fail(path, 'must be between 0.01 and 999999999999.99')
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) fail(path, 'must have at most two decimal places')
  return value
}

export function validatePrice(value, path = 'price') {
  assertPlainObject(value, path)
  assertExactKeys(value, ['mode', 'amount', 'old_amount', 'currency'], ['mode', 'amount', 'old_amount', 'currency'], path)

  const mode = assertEnum(value.mode, PRICE_MODES, `${path}.mode`)
  const amount = value.amount === null ? null : validateMoneyAmount(value.amount, `${path}.amount`)
  const oldAmount = value.old_amount === null ? null : validateMoneyAmount(value.old_amount, `${path}.old_amount`)

  if ((mode === 'exact' || mode === 'from') && amount === null) {
    fail(`${path}.amount`, `${mode} price requires a positive amount`)
  }
  if (oldAmount !== null && amount === null) {
    fail(`${path}.old_amount`, 'requires a current amount')
  }
  if (oldAmount !== null && oldAmount <= amount) {
    fail(`${path}.old_amount`, 'must be greater than the current amount')
  }
  if (value.currency !== CURRENCY) fail(`${path}.currency`, `must be ${CURRENCY}`)

  return { mode, amount, old_amount: oldAmount, currency: CURRENCY }
}

export function validateLocalizedFields(value, path = 'localized') {
  assertPlainObject(value, path)
  assertExactKeys(value, ['ru', 'kk'], ['ru'], path)
  return {
    ru: validateText(value.ru, `${path}.ru`),
    kk: value.kk === null || value.kk === undefined
      ? null
      : validateText(value.kk, `${path}.kk`),
  }
}

function validateNullableSlugOrUndefined(value, path) {
  if (value === undefined || value === null) return null
  return validateSlug(value, path)
}

function validateNullableSkuOrUndefined(value, path) {
  if (value === undefined || value === null) return null
  return validateSku(value, path)
}

function validateCommonIdentity(value, path) {
  return {
    id: validateUUID(value.id, `${path}.id`),
    slug: validateSlug(value.slug, `${path}.slug`),
    sku: validateNullableSku(value.sku, `${path}.sku`),
    category_slug: validateSlug(value.category_slug, `${path}.category_slug`),
    brand_slug: validateNullableSlug(value.brand_slug, `${path}.brand_slug`),
  }
}

export function validatePublicProductDTO(value) {
  const path = 'publicProduct'
  assertPlainObject(value, path)
  assertExactKeys(value, PUBLIC_PRODUCT_DTO_FIELDS, PUBLIC_PRODUCT_DTO_FIELDS, path)
  const identity = validateCommonIdentity(value, path)

  return {
    ...identity,
    locale: validateLocale(value.locale, `${path}.locale`),
    name: validateText(value.name, `${path}.name`, { max: 200 }),
    short_description: validateNullableText(value.short_description, `${path}.short_description`),
    description: validateNullableText(value.description, `${path}.description`),
    price: validatePrice(value.price, `${path}.price`),
    stock_status: assertEnum(value.stock_status, STOCK_STATUSES, `${path}.stock_status`),
    image_url: validateNullableUrl(value.image_url, `${path}.image_url`),
  }
}

function validateAdminLocalizedText(value, path) {
  return value === null ? null : validateText(value, path)
}

export function validateAdminProductDTO(value) {
  const path = 'adminProduct'
  assertPlainObject(value, path)
  assertExactKeys(value, ADMIN_PRODUCT_DTO_FIELDS, ADMIN_PRODUCT_DTO_FIELDS, path)
  const identity = validateCommonIdentity(value, path)

  const translationStatus = assertEnum(
    value.translation_status_kk,
    TRANSLATION_STATUSES,
    `${path}.translation_status_kk`
  )
  if (value.publish_kk && translationStatus !== 'verified') {
    fail(`${path}.publish_kk`, 'requires verified Kazakh translation')
  }

  return {
    ...identity,
    external_id: validateNullableText(value.external_id, `${path}.external_id`, { max: 200 }),
    name_ru: validateText(value.name_ru, `${path}.name_ru`, { max: 200 }),
    name_kk: validateAdminLocalizedText(value.name_kk, `${path}.name_kk`),
    short_description_ru: validateText(value.short_description_ru, `${path}.short_description_ru`),
    short_description_kk: validateAdminLocalizedText(value.short_description_kk, `${path}.short_description_kk`),
    description_ru: validateText(value.description_ru, `${path}.description_ru`),
    description_kk: validateAdminLocalizedText(value.description_kk, `${path}.description_kk`),
    price: validatePrice(value.price, `${path}.price`),
    stock_status: assertEnum(value.stock_status, STOCK_STATUSES, `${path}.stock_status`),
    publication_status: assertEnum(value.publication_status, PUBLICATION_STATUSES, `${path}.publication_status`),
    publish_ru: validateBoolean(value.publish_ru, `${path}.publish_ru`),
    publish_kk: validateBoolean(value.publish_kk, `${path}.publish_kk`),
    translation_status_kk: translationStatus,
    is_featured: validateBoolean(value.is_featured, `${path}.is_featured`),
    source_type: validateNullableEnum(value.source_type, SOURCE_TYPES, `${path}.source_type`),
    source_reference: validateNullableText(value.source_reference, `${path}.source_reference`, { max: 2048 }),
    source_hash: validateNullableText(value.source_hash, `${path}.source_hash`, { max: 128 }),
  }
}

function validateImportPrice(value) {
  return validatePrice({
    mode: value.price_mode,
    amount: value.price_amount,
    old_amount: value.old_price_amount,
    currency: value.currency,
  }, 'importRow.price')
}

export function validateImportProductRow(value) {
  const path = 'importRow'
  assertPlainObject(value, path)
  assertExactKeys(value, IMPORT_PRODUCT_ROW_FIELDS, IMPORT_PRODUCT_ROW_FIELDS, path)
  const price = validateImportPrice(value)
  const translationStatus = assertEnum(value.translation_status_kk, TRANSLATION_STATUSES, `${path}.translation_status_kk`)
  if (value.publish_kk && translationStatus !== 'verified') {
    fail(`${path}.publish_kk`, 'requires verified Kazakh translation')
  }

  return {
    source_type: assertEnum(value.source_type, SOURCE_TYPES, `${path}.source_type`),
    source_reference: validateNullableText(value.source_reference, `${path}.source_reference`, { max: 2048 }),
    source_hash: validateNullableText(value.source_hash, `${path}.source_hash`, { max: 128 }),
    external_id: validateNullableText(value.external_id, `${path}.external_id`, { max: 200 }),
    sku: validateNullableSkuOrUndefined(value.sku, `${path}.sku`),
    slug: validateNullableSlugOrUndefined(value.slug, `${path}.slug`),
    category_slug: validateSlug(value.category_slug, `${path}.category_slug`),
    brand_slug: validateNullableSlug(value.brand_slug, `${path}.brand_slug`),
    name_ru: validateText(value.name_ru, `${path}.name_ru`, { max: 200 }),
    name_kk: validateNullableText(value.name_kk, `${path}.name_kk`),
    short_description_ru: validateNullableText(value.short_description_ru, `${path}.short_description_ru`),
    short_description_kk: validateNullableText(value.short_description_kk, `${path}.short_description_kk`),
    description_ru: validateNullableText(value.description_ru, `${path}.description_ru`),
    description_kk: validateNullableText(value.description_kk, `${path}.description_kk`),
    price_mode: price.mode,
    price_amount: price.amount,
    old_price_amount: price.old_amount,
    currency: price.currency,
    stock_status: assertEnum(value.stock_status, STOCK_STATUSES, `${path}.stock_status`),
    publication_status: assertEnum(value.publication_status, PUBLICATION_STATUSES, `${path}.publication_status`),
    publish_ru: validateBoolean(value.publish_ru, `${path}.publish_ru`),
    publish_kk: validateBoolean(value.publish_kk, `${path}.publish_kk`),
    translation_status_kk: translationStatus,
    is_featured: validateBoolean(value.is_featured, `${path}.is_featured`),
    image_url: validateNullableUrl(value.image_url, `${path}.image_url`),
  }
}
