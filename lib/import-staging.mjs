import { createHash } from 'node:crypto'
import { validateImportProductRow } from './domain-contracts.mjs'

export const IMPORT_LIMITS = Object.freeze({
  maxSourceBytes: 5 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 64,
  maxCellChars: 10000,
  maxMatchCandidates: 20000,
})

export const IMPORT_FIELDS = Object.freeze([
  'source_type', 'source_reference', 'source_hash', 'external_id', 'sku', 'slug', 'category_slug', 'brand_slug',
  'name_ru', 'name_kk', 'short_description_ru', 'short_description_kk', 'description_ru', 'description_kk',
  'price_mode', 'price_amount', 'old_price_amount', 'currency', 'stock_status', 'publication_status', 'publish_ru',
  'publish_kk', 'translation_status_kk', 'is_featured', 'image_url',
])

const IMPORT_FIELD_SET = new Set(IMPORT_FIELDS)
const SOURCE_FIELDS = new Set(['source_type', 'source_reference', 'source_hash'])
const BOOLEAN_FIELDS = new Set(['publish_ru', 'publish_kk', 'is_featured'])
const NUMBER_FIELDS = new Set(['price_amount', 'old_price_amount'])
const NULLABLE_FIELDS = new Set([
  'source_reference', 'external_id', 'sku', 'slug', 'brand_slug', 'name_kk', 'short_description_ru',
  'short_description_kk', 'description_ru', 'description_kk', 'price_amount', 'old_price_amount', 'image_url',
])

export class ImportInputError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ImportInputError'
    this.status = status
  }
}

function fail(message, status = 400) {
  throw new ImportInputError(message, status)
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`)
}

function assertCellLimit(value, field) {
  if (typeof value === 'string' && value.length > IMPORT_LIMITS.maxCellChars) fail(`${field} exceeds the cell limit`)
}

function scanFormulaLike(value, warnings, path) {
  if (typeof value === 'string') {
    assertCellLimit(value, path)
    if (/^[=+\-@]/.test(value.trim())) warnings.push(`${path} looks like a spreadsheet formula; it is stored as text and never evaluated`)
    return
  }
  if (Array.isArray(value)) value.forEach((item, index) => scanFormulaLike(item, warnings, `${path}[${index}]`))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => scanFormulaLike(item, warnings, `${path}.${key}`))
}

export function normalizeMapping(mapping) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return null
  const seenSourceKeys = new Set()
  const rawEntries = Object.entries(mapping)

  for (const [rawKey] of rawEntries) {
    const key = String(rawKey).trim()
    if (key === '') {
      throw new ImportInputError('Mapping source column key cannot be empty')
    }
    if (seenSourceKeys.has(key)) {
      throw new ImportInputError(`Mapping contains duplicate source column key "${key}" after trimming`)
    }
    seenSourceKeys.add(key)
  }

  const sortedKeys = Array.from(seenSourceKeys).sort()
  const normalized = {}
  for (const key of sortedKeys) {
    const entry = rawEntries.find(([k]) => String(k).trim() === key)
    if (entry && typeof entry[1] === 'string') {
      const trimmedVal = entry[1].trim()
      if (trimmedVal !== '') {
        normalized[key] = trimmedVal
      }
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null
}

export function hashSource(buffer, options = {}) {
  const hash = createHash('sha256').update(buffer)
  if (options?.sheet) {
    hash.update(`\u0000sheet:${options.sheet}`)
  }
  const normMap = normalizeMapping(options?.mapping)
  if (normMap) {
    hash.update(`\u0000mapping:${JSON.stringify(normMap)}`)
  }
  return hash.digest('hex')
}

export function sourceTypeFromFilename(filename) {
  const normalized = String(filename || '').toLowerCase()
  if (normalized.endsWith('.json')) return 'json'
  if (normalized.endsWith('.csv')) return 'csv'
  if (normalized.endsWith('.xlsx')) return 'xlsx'
  return null
}

function finishCsvField(fields, field, rowNumber) {
  assertCellLimit(field, `row ${rowNumber}`)
  fields.push(field)
}

export function parseCsv(text) {
  if (typeof text !== 'string') fail('CSV source must be UTF-8 text')
  const rows = []
  let fields = []
  let field = ''
  let quoted = false
  let rowNumber = 1
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }
    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      finishCsvField(fields, field, rowNumber)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      finishCsvField(fields, field, rowNumber)
      if (fields.some((value) => value !== '')) rows.push(fields)
      fields = []
      field = ''
      rowNumber += 1
      if (rows.length > IMPORT_LIMITS.maxRows + 1) fail(`CSV exceeds ${IMPORT_LIMITS.maxRows} rows`, 413)
    } else {
      field += character
    }
  }
  if (quoted) fail(`CSV row ${rowNumber} has an unterminated quoted field`)
  if (field.length > 0 || fields.length > 0) {
    finishCsvField(fields, field, rowNumber)
    if (fields.some((value) => value !== '')) rows.push(fields)
  }
  if (rows.length === 0) fail('CSV is empty')
  const headers = rows.shift().map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim())
  if (headers.length > IMPORT_LIMITS.maxColumns) fail(`CSV exceeds ${IMPORT_LIMITS.maxColumns} columns`, 413)
  if (headers.some((header) => !header || !IMPORT_FIELD_SET.has(header))) fail('CSV headers must use the normalized import field names')
  if (new Set(headers).size !== headers.length) fail('CSV contains duplicate headers')
  return rows.map((values, rowIndex) => {
    const row = {}
    headers.forEach((header, index) => {
      const value = values[index] ?? ''
      if (value !== '') row[header] = csvValue(header, value)
    })
    return row
  })
}

function csvValue(field, value) {
  if (value === 'null' && NULLABLE_FIELDS.has(field)) return null
  if (BOOLEAN_FIELDS.has(field)) {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  if (NUMBER_FIELDS.has(field) && value !== '') {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return value
}

export function parseJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail('JSON source is invalid')
  }
  if (Array.isArray(parsed)) return parsed
  assertObject(parsed, 'JSON root')
  if (Object.keys(parsed).some((key) => key !== 'rows')) fail('JSON root may contain only rows')
  if (!Array.isArray(parsed.rows)) fail('JSON root.rows must be an array')
  return parsed.rows
}

function rawFields(raw) {
  assertObject(raw, 'row')
  for (const key of Object.keys(raw)) if (!IMPORT_FIELD_SET.has(key)) fail(`row.${key} is not an allowed import field`)
  return raw
}

function normalizeSourceReference(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.trim().length > 2048) fail('source_reference is invalid')
  return value.trim()
}

function cleanRawValue(value) {
  if (typeof value === 'string') return value.trim() || null
  return value
}

function existingToImportRow(product, context) {
  return {
    source_type: context.sourceType,
    source_reference: context.sourceReference,
    source_hash: context.sourceHash,
    external_id: product.external_id ?? null,
    sku: product.sku ?? null,
    slug: product.slug ?? null,
    category_slug: product.category?.slug ?? null,
    brand_slug: product.brand?.slug ?? null,
    name_ru: product.name_ru ?? product.name ?? null,
    name_kk: product.name_kk ?? null,
    short_description_ru: product.short_description_ru ?? null,
    short_description_kk: product.short_description_kk ?? null,
    description_ru: product.description_ru ?? product.description ?? null,
    description_kk: product.description_kk ?? null,
    price_mode: product.price_mode ?? 'request',
    price_amount: product.price_amount === undefined ? null : product.price_amount,
    old_price_amount: product.old_price_amount === undefined ? null : product.old_price_amount,
    currency: product.currency ?? 'KZT',
    stock_status: product.stock_status ?? 'unknown',
    publication_status: product.publication_status ?? 'draft',
    publish_ru: product.publish_ru ?? false,
    publish_kk: product.publish_kk ?? false,
    translation_status_kk: product.translation_status_kk ?? 'missing',
    is_featured: product.is_featured ?? false,
    image_url: product.image_url ?? null,
  }
}

export function matchKeyForExternalId(sourceType, sourceReference, externalId) {
  if (!externalId) return null
  return `${sourceType}\u0000${sourceReference || ''}\u0000${externalId}`
}

function buildIndexes(products, context) {
  const bySku = new Map()
  const byExternalId = new Map()
  for (const product of products) {
    if (product.sku) bySku.set(product.sku, product)
    const key = matchKeyForExternalId(product.source_type, product.source_reference, product.external_id)
    if (key) {
      const current = byExternalId.get(key)
      byExternalId.set(key, current ? [...(Array.isArray(current) ? current : [current]), product] : product)
    }
  }
  return { bySku, byExternalId, context }
}

function findMatch(raw, indexes) {
  const skuMatch = raw.sku ? indexes.bySku.get(raw.sku) : null
  const externalKey = matchKeyForExternalId(indexes.context.sourceType, indexes.context.sourceReference, raw.external_id)
  const externalMatches = externalKey ? indexes.byExternalId.get(externalKey) : null
  const externalMatch = Array.isArray(externalMatches) ? (externalMatches.length === 1 ? externalMatches[0] : 'ambiguous') : externalMatches
  if (skuMatch && externalMatch && skuMatch !== externalMatch) return { error: 'SKU and source-scoped external_id match different products' }
  if (externalMatch === 'ambiguous') return { error: 'source-scoped external_id matches multiple products' }
  return { product: skuMatch || externalMatch || null }
}

function duplicateKeys(raw, context) {
  const keys = []
  if (raw.sku) keys.push(`sku:${raw.sku}`)
  const externalKey = matchKeyForExternalId(context.sourceType, context.sourceReference, raw.external_id)
  if (externalKey) keys.push(`external:${externalKey}`)
  return keys
}

function forceDraft(candidate, raw, warnings, rowNumber) {
  const hasPublicationInput = raw.publication_status !== undefined || raw.publish_ru !== undefined || raw.publish_kk !== undefined
  const hasFeaturedInput = raw.is_featured !== undefined
  const wantsPublished = hasPublicationInput && (raw.publication_status === 'published' || raw.publish_ru === true || raw.publish_kk === true)
  const wantsFeatured = hasFeaturedInput && raw.is_featured === true

  if (wantsPublished || (wantsFeatured && hasPublicationInput)) {
    warnings.push(`row ${rowNumber}: publication fields were forced to draft/false; import never publishes products`)
    if (raw.publication_status === 'published') candidate.publication_status = 'draft'
    if (raw.publish_ru === true) candidate.publish_ru = false
    if (raw.publish_kk === true) candidate.publish_kk = false
    // is_featured is also forced to false when publication is being forced,
    // since promoting products to featured is a promotion action reserved for human admins.
    if (wantsFeatured) candidate.is_featured = false
  } else if (wantsFeatured) {
    // is_featured requested without publication fields: still force to false as import safety measure
    warnings.push(`row ${rowNumber}: is_featured was forced to false; import never promotes products to featured`)
    candidate.is_featured = false
  }
}


export function normalizeRows(rawRows, { sourceType, sourceReference, sourceHash, existingProducts = [] }) {
  if (!['json', 'csv', 'xlsx', 'text_agent'].includes(sourceType)) fail('Only JSON, CSV, XLSX, and text_agent imports are supported by T09')
  if (!Array.isArray(rawRows) || rawRows.length === 0) fail('Import must contain at least one row')
  if (rawRows.length > IMPORT_LIMITS.maxRows) fail(`Import exceeds ${IMPORT_LIMITS.maxRows} rows`, 413)
  const context = { sourceType, sourceReference: normalizeSourceReference(sourceReference), sourceHash }
  const indexes = buildIndexes(existingProducts, context)
  const seen = new Set()
  const rows = []
  const summary = { rows: rawRows.length, create: 0, update: 0, skip: 0, error: 0, warnings: 0, duplicate: 0 }

  rawRows.forEach((input, index) => {
    const rowNumber = index + 1
    const rowWarnings = []
    const rowErrors = []
    let raw
    try {
      raw = rawFields(input)
      scanFormulaLike(raw, rowWarnings, `row ${rowNumber}`)
      raw = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, cleanRawValue(value)]))
    } catch (error) {
      rowErrors.push(error.message)
      raw = {}
    }
    const keys = duplicateKeys(raw, context)
    if (keys.some((key) => seen.has(key))) {
      rowErrors.push('duplicate SKU/source-scoped external_id within the same source')
      summary.duplicate += 1
    }
    keys.forEach((key) => seen.add(key))
    const match = rowErrors.length === 0 ? findMatch(raw, indexes) : { product: null }
    if (match.error) rowErrors.push(match.error)
    const existing = match.product && match.product !== 'ambiguous' ? match.product : null
    const candidate = { ...(existing ? existingToImportRow(existing, context) : {}), ...raw, source_type: sourceType, source_reference: context.sourceReference, source_hash: sourceHash }
    for (const field of IMPORT_FIELDS) if (candidate[field] === undefined) candidate[field] = null
    candidate.price_mode = candidate.price_mode || 'request'
    candidate.currency = candidate.currency || 'KZT'
    candidate.stock_status = candidate.stock_status || 'unknown'
    candidate.publication_status = candidate.publication_status || 'draft'
    candidate.publish_ru = candidate.publish_ru ?? false
    candidate.publish_kk = candidate.publish_kk ?? false
    candidate.translation_status_kk = candidate.translation_status_kk || 'missing'
    candidate.is_featured = candidate.is_featured ?? false
    forceDraft(candidate, raw, rowWarnings, rowNumber)
    if (!existing && !candidate.sku) rowErrors.push('new products require sku')
    if (!existing && !candidate.name_ru) rowErrors.push('new products require name_ru')
    if (!existing && !candidate.category_slug) rowErrors.push('new products require category_slug')
    if (candidate.publish_kk && candidate.translation_status_kk !== 'verified') candidate.publish_kk = false
    let normalizedPayload = null
    if (rowErrors.length === 0) {
      try { normalizedPayload = validateImportProductRow(candidate) } catch (error) { rowErrors.push(error.message) }
    }
    const action = rowErrors.length > 0 ? 'error' : existing ? 'update' : 'create'
    if (rowErrors.length === 0 && existing && !hasMeaningfulChanges(raw, normalizedPayload, existing, context)) {
      rows.push({ row_number: rowNumber, raw_payload: raw, normalized_payload: normalizedPayload, matched_product_id: existing.id, proposed_action: 'skip', validation_errors: [], validation_warnings: rowWarnings, status: 'validated' })
      summary.skip += 1
    } else {
      rows.push({ row_number: rowNumber, raw_payload: raw, normalized_payload: normalizedPayload, matched_product_id: existing?.id || null, proposed_action: action, validation_errors: rowErrors, validation_warnings: rowWarnings, status: rowErrors.length ? 'needs_review' : 'validated' })
      summary[action] += 1
    }
    summary.warnings += rowWarnings.length
  })
  return { rows, summary, context }
}

function currentField(product, field) {
  if (field === 'category_slug') return product.category?.slug ?? null
  if (field === 'brand_slug') return product.brand?.slug ?? null
  if (field === 'name_ru') return product.name_ru ?? product.name ?? null
  if (field === 'description_ru') return product.description_ru ?? product.description ?? null
  return product[field] ?? null
}

function equalValue(left, right) {
  if (left === null || left === undefined || left === '') return right === null || right === undefined || right === ''
  if (typeof left === 'number' || typeof right === 'number') return Number(left) === Number(right)
  return left === right
}

function hasMeaningfulChanges(raw, normalized, existing, context) {
  const fields = Object.keys(raw).filter((field) => !SOURCE_FIELDS.has(field) && IMPORT_FIELD_SET.has(field))
  const compared = fields.length > 0 ? fields : IMPORT_FIELDS.filter((field) => !SOURCE_FIELDS.has(field))
  return compared.some((field) => !equalValue(normalized[field], currentField(existing, field)))
}

export function buildFieldDiff(row, existing = null) {
  if (row.proposed_action === 'error') return { action: 'error', fields: [], errors: row.validation_errors || [], warnings: row.validation_warnings || [] }
  if (row.proposed_action === 'skip') return { action: 'skip', fields: [], errors: [], warnings: row.validation_warnings || [] }
  const fields = []
  for (const field of IMPORT_FIELDS) {
    if (SOURCE_FIELDS.has(field) || field === 'currency') continue
    const next = row.normalized_payload?.[field] ?? null
    const previous = existing ? currentField(existing, field) : null
    if (!existing || !equalValue(next, previous)) fields.push({ field, before: previous, after: next })
  }
  return { action: row.proposed_action, fields, errors: row.validation_errors || [], warnings: row.validation_warnings || [] }
}
