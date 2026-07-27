import { revalidatePath, revalidateTag } from 'next/cache.js'
import {
  CURRENCY,
  PRICE_MODES,
  PUBLICATION_STATUSES,
  STOCK_STATUSES,
  TRANSLATION_STATUSES,
} from './domain-contracts.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const CODE_RE = /^[a-z0-9][a-z0-9_]*$/
const URL_RE = /^https?:\/\//i
const MAX_PAGE_SIZE = 50

export const PRODUCT_ADMIN_SELECT = [
  'id', 'name', 'category', 'description', 'image_url', 'sort_order', 'created_at', 'updated_at',
  'sku', 'external_id', 'slug', 'category_id', 'brand_id',
  'name_ru', 'name_kk', 'short_description_ru', 'short_description_kk',
  'description_ru', 'description_kk', 'warranty_ru', 'warranty_kk',
  'price_mode', 'price_amount', 'old_price_amount', 'currency', 'stock_status',
  'publication_status', 'publish_ru', 'publish_kk', 'translation_status_kk', 'is_featured',
  'seo_title_ru', 'seo_title_kk', 'seo_description_ru', 'seo_description_kk',
  'category:categories(id,slug,name_ru,name_kk,status,parent_id)',
  'brand:brands(id,slug,name,status)',
  'product_images(id,storage_path,source_url,alt_ru,alt_kk,sort_order,is_primary,created_at)',
  'product_attribute_values(id,attribute_id,value_text_ru,value_text_kk,value_number,value_boolean,value_option,raw_value,attribute:attributes(id,code,name_ru,name_kk,unit_ru,unit_kk,data_type,status,sort_order))',
].join(',')

export class AdminCatalogValidationError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'AdminCatalogValidationError'
    this.status = status
  }
}

function fail(message, status = 400) {
  throw new AdminCatalogValidationError(message, status)
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`)
  return value
}

function exactKeys(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${field}.${key} is not allowed`)
  }
}

function text(value, field, { required = false, max = 10000 } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`${field} is required`)
    return null
  }
  if (typeof value !== 'string') fail(`${field} must be a string`)
  const result = value.trim()
  if (required && !result) fail(`${field} is required`)
  if (result.length > max) fail(`${field} is too long`)
  if (/[\u0000-\u001f\u007f]/.test(result)) fail(`${field} contains unsupported characters`)
  return result || null
}

function nullableUUID(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID_RE.test(value)) fail(`${field} must be a UUID`)
  return value
}

function enumValue(value, values, field, fallback) {
  const result = value === undefined ? fallback : value
  if (!values.includes(result)) fail(`${field} is invalid`)
  return result
}

function booleanValue(value, field, fallback = false) {
  const result = value === undefined ? fallback : value
  if (typeof result !== 'boolean') fail(`${field} must be a boolean`)
  return result
}

function integerValue(value, field, fallback = 0) {
  const result = value === undefined ? fallback : value
  if (!Number.isSafeInteger(result) || result < 0 || result > 100000) fail(`${field} must be a non-negative integer`)
  return result
}

function slug(value, field, required = true) {
  const result = text(value, field, { required, max: 120 })
  if (result && !SLUG_RE.test(result)) fail(`${field} must use lowercase ASCII slug syntax`)
  return result
}

function sku(value, field, required = true) {
  const result = text(value, field, { required, max: 64 })
  if (result && !SKU_RE.test(result)) fail(`${field} must use letters, digits, dot, underscore, or hyphen`)
  return result
}

function url(value, field) {
  const result = text(value, field, { max: 2048 })
  if (result && !URL_RE.test(result)) fail(`${field} must be an http(s) URL`)
  return result
}

function price(value) {
  const input = object(value || {}, 'price')
  exactKeys(input, ['mode', 'amount', 'old_amount', 'currency'], 'price')
  const mode = enumValue(input.mode, PRICE_MODES, 'price.mode', 'request')
  const amount = input.amount === null || input.amount === undefined || input.amount === '' ? null : Number(input.amount)
  const oldAmount = input.old_amount === null || input.old_amount === undefined || input.old_amount === '' ? null : Number(input.old_amount)
  for (const [field, number] of [['price.amount', amount], ['price.old_amount', oldAmount]]) {
    if (number !== null && (!Number.isFinite(number) || number <= 0 || number > 999999999999.99 || Math.round(number * 100) !== number * 100)) {
      fail(`${field} must be a positive amount with at most two decimals`)
    }
  }
  if ((mode === 'exact' || mode === 'from') && amount === null) fail(`price.amount is required for ${mode}`)
  if (oldAmount !== null && (amount === null || oldAmount <= amount)) fail('price.old_amount must exceed price.amount')
  if (input.currency !== undefined && input.currency !== CURRENCY) fail(`price.currency must be ${CURRENCY}`)
  return { mode, amount, old_amount: oldAmount, currency: CURRENCY }
}

function localizedText(value, field, { required = false } = {}) {
  const input = object(value || {}, field)
  exactKeys(input, ['title', 'description'], field)
  return {
    title: text(input.title, `${field}.title`, { max: 160 }),
    description: text(input.description, `${field}.description`, { max: 320 }),
    ...(required ? {} : {}),
  }
}

function seo(value) {
  const input = object(value || {}, 'seo')
  exactKeys(input, ['ru', 'kk'], 'seo')
  return { ru: localizedText(input.ru, 'seo.ru'), kk: localizedText(input.kk, 'seo.kk') }
}

function validateAttributeValues(values) {
  if (values === undefined) return undefined
  if (!Array.isArray(values) || values.length > 100) fail('attributes must be an array with at most 100 items')
  const seen = new Set()
  return values.map((input, index) => {
    const field = `attributes[${index}]`
    object(input, field)
    exactKeys(input, [
      'attribute_id', 'value_text_ru', 'value_text_kk', 'value_number', 'value_boolean', 'value_option', 'raw_value', 'data_type',
    ], field)

    const attributeId = nullableUUID(input.attribute_id, `${field}.attribute_id`)
    if (!attributeId) fail(`${field}.attribute_id is required`)
    if (seen.has(attributeId)) fail(`${field}.attribute_id must be unique per product`)
    seen.add(attributeId)

    const dataType = input.data_type ? enumValue(input.data_type, ['text', 'number', 'boolean', 'option'], `${field}.data_type`, 'text') : null

    const valueTextRu = text(input.value_text_ru, `${field}.value_text_ru`, { max: 2000 })
    const valueTextKk = text(input.value_text_kk, `${field}.value_text_kk`, { max: 2000 })

    let valueNumber = input.value_number === null || input.value_number === undefined || input.value_number === '' ? null : Number(input.value_number)
    let valueBoolean = input.value_boolean === null || input.value_boolean === undefined ? null : input.value_boolean
    let valueOption = text(input.value_option, `${field}.value_option`, { max: 200 })
    const rawValue = text(input.raw_value, `${field}.raw_value`, { max: 2000 })

    if (valueNumber !== null) {
      if (!Number.isFinite(valueNumber) || valueNumber < -1000000000 || valueNumber > 1000000000) {
        fail(`${field}.value_number must be a finite number within bounds`)
      }
    }

    if (valueBoolean !== null && typeof valueBoolean !== 'boolean') {
      fail(`${field}.value_boolean must be boolean`)
    }

    const nonNullTypedCount = [valueNumber, valueBoolean, valueOption].filter((v) => v !== null).length
    if (nonNullTypedCount > 1) {
      fail(`${field} has conflicting typed values`)
    }

    if (dataType === 'text') {
      if (valueNumber !== null || valueBoolean !== null || valueOption !== null) {
        fail(`${field} with text data_type cannot have number, boolean, or option values`)
      }
    } else if (dataType === 'number') {
      if (valueBoolean !== null || valueOption !== null) {
        fail(`${field} with number data_type cannot have boolean or option values`)
      }
    } else if (dataType === 'boolean') {
      if (valueNumber !== null || valueOption !== null) {
        fail(`${field} with boolean data_type cannot have number or option values`)
      }
    } else if (dataType === 'option') {
      if (valueNumber !== null || valueBoolean !== null) {
        fail(`${field} with option data_type cannot have number or boolean values`)
      }
    }

    return {
      attribute_id: attributeId,
      value_text_ru: valueTextRu,
      value_text_kk: valueTextKk,
      value_number: valueNumber,
      value_boolean: valueBoolean,
      value_option: valueOption,
      raw_value: rawValue,
    }
  })
}

export function validateProductCMSPayload(input) {
  const value = object(input, 'product')
  exactKeys(value, [
    'sku', 'external_id', 'slug', 'category_id', 'brand_id', 'name_ru', 'name_kk',
    'short_description_ru', 'short_description_kk', 'description_ru', 'description_kk',
    'warranty_ru', 'warranty_kk', 'price', 'stock_status', 'publication_status',
    'publish_ru', 'publish_kk', 'translation_status_kk', 'is_featured', 'sort_order', 'seo', 'attributes',
  ], 'product')
  const result = {
    sku: sku(value.sku, 'sku'),
    external_id: text(value.external_id, 'external_id', { max: 200 }),
    slug: slug(value.slug, 'slug'),
    category_id: nullableUUID(value.category_id, 'category_id'),
    brand_id: nullableUUID(value.brand_id, 'brand_id'),
    name_ru: text(value.name_ru, 'name_ru', { required: true, max: 200 }),
    name_kk: text(value.name_kk, 'name_kk', { max: 200 }),
    short_description_ru: text(value.short_description_ru, 'short_description_ru', { max: 1000 }),
    short_description_kk: text(value.short_description_kk, 'short_description_kk', { max: 1000 }),
    description_ru: text(value.description_ru, 'description_ru'),
    description_kk: text(value.description_kk, 'description_kk'),
    warranty_ru: text(value.warranty_ru, 'warranty_ru', { max: 1000 }),
    warranty_kk: text(value.warranty_kk, 'warranty_kk', { max: 1000 }),
    price: price(value.price),
    stock_status: enumValue(value.stock_status, STOCK_STATUSES, 'stock_status', 'unknown'),
    publication_status: enumValue(value.publication_status, PUBLICATION_STATUSES, 'publication_status', 'draft'),
    publish_ru: booleanValue(value.publish_ru, 'publish_ru'),
    publish_kk: booleanValue(value.publish_kk, 'publish_kk'),
    translation_status_kk: enumValue(value.translation_status_kk, TRANSLATION_STATUSES, 'translation_status_kk', 'missing'),
    is_featured: booleanValue(value.is_featured, 'is_featured'),
    sort_order: integerValue(value.sort_order, 'sort_order'),
    seo: seo(value.seo),
    attributes: validateAttributeValues(value.attributes),
  }
  if (result.publish_kk && result.translation_status_kk !== 'verified') fail('publish_kk requires verified Kazakh translation')
  if (result.publication_status === 'published' && (!result.sku || !result.slug || !result.category_id)) {
    fail('published products require sku, slug, and category_id')
  }
  return result
}

export function validateCategoryCMSPayload(input) {
  const value = object(input, 'category')
  exactKeys(value, ['parent_id', 'slug', 'name_ru', 'name_kk', 'description_ru', 'description_kk', 'seo', 'sort_order', 'status'], 'category')
  return {
    parent_id: nullableUUID(value.parent_id, 'parent_id'),
    slug: slug(value.slug, 'slug'),
    name_ru: text(value.name_ru, 'name_ru', { required: true, max: 200 }),
    name_kk: text(value.name_kk, 'name_kk', { max: 200 }),
    description_ru: text(value.description_ru, 'description_ru'),
    description_kk: text(value.description_kk, 'description_kk'),
    seo: seo(value.seo),
    sort_order: integerValue(value.sort_order, 'sort_order'),
    status: enumValue(value.status, PUBLICATION_STATUSES, 'status', 'draft'),
  }
}

export function validateBrandCMSPayload(input) {
  const value = object(input, 'brand')
  exactKeys(value, ['slug', 'name', 'description_ru', 'description_kk', 'logo_url', 'website_url', 'sort_order', 'status'], 'brand')
  return {
    slug: slug(value.slug, 'slug'),
    name: text(value.name, 'name', { required: true, max: 200 }),
    description_ru: text(value.description_ru, 'description_ru'),
    description_kk: text(value.description_kk, 'description_kk'),
    logo_url: url(value.logo_url, 'logo_url'),
    website_url: url(value.website_url, 'website_url'),
    sort_order: integerValue(value.sort_order, 'sort_order'),
    status: enumValue(value.status, PUBLICATION_STATUSES, 'status', 'draft'),
  }
}

export function validateAttributeCMSPayload(input) {
  const value = object(input, 'attribute')
  exactKeys(value, ['category_id', 'code', 'name_ru', 'name_kk', 'data_type', 'unit_ru', 'unit_kk', 'options', 'is_filterable', 'sort_order', 'status'], 'attribute')
  if (typeof value.code !== 'string' || !CODE_RE.test(value.code.trim())) fail('code must use lowercase letters, digits, and underscores')
  const dataType = enumValue(value.data_type, ['text', 'number', 'boolean', 'option'], 'data_type', 'text')
  const rawOptions = value.options ?? []
  if (!Array.isArray(rawOptions) || rawOptions.length > 100) {
    fail('options must be an array with at most 100 items')
  }
  const options = rawOptions.map((option, index) => text(option, `options[${index}]`, { required: true, max: 200 }))
  if (new Set(options).size !== options.length) fail('options must contain unique values')
  if (dataType === 'option' && options.length === 0) fail('option attributes require at least one option')
  if (dataType !== 'option' && options.length > 0) fail('options are only allowed for option attributes')

  return {
    category_id: nullableUUID(value.category_id, 'category_id'),
    code: value.code.trim(),
    name_ru: text(value.name_ru, 'name_ru', { required: true, max: 200 }),
    name_kk: text(value.name_kk, 'name_kk', { max: 200 }),
    data_type: dataType,
    unit_ru: text(value.unit_ru, 'unit_ru', { max: 40 }),
    unit_kk: text(value.unit_kk, 'unit_kk', { max: 40 }),
    options,
    is_filterable: booleanValue(value.is_filterable, 'is_filterable'),
    sort_order: integerValue(value.sort_order, 'sort_order'),
    status: enumValue(value.status, PUBLICATION_STATUSES, 'status', 'published'),
  }
}

export function parseAdminPageParams(searchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20))
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const quality = searchParams.get('quality') || ''
  const allowedQuality = new Set(['missing_sku', 'missing_kz', 'missing_image', 'missing_category', 'missing_brand'])
  if (quality && !allowedQuality.has(quality)) fail('quality is invalid')
  if (searchParams.get('status') && !PUBLICATION_STATUSES.includes(searchParams.get('status'))) fail('status is invalid')
  if (searchParams.get('priceMode') && !PRICE_MODES.includes(searchParams.get('priceMode'))) fail('priceMode is invalid')
  if (searchParams.get('translation') && !TRANSLATION_STATUSES.includes(searchParams.get('translation'))) fail('translation is invalid')
  return {
    page,
    pageSize,
    q,
    quality,
    status: searchParams.get('status') || '',
    categoryId: searchParams.get('categoryId') || '',
    brandId: searchParams.get('brandId') || '',
    priceMode: searchParams.get('priceMode') || '',
    translation: searchParams.get('translation') || '',
  }
}

export function normalizeAdminProduct(row) {
  const images = Array.isArray(row.product_images) ? [...row.product_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : []
  const values = Array.isArray(row.product_attribute_values) ? row.product_attribute_values : []
  const issues = []
  if (!row.sku) issues.push('missing_sku')
  if (!row.name_kk) issues.push('missing_kz')
  if (!row.category_id) issues.push('missing_category')
  if (!row.brand_id) issues.push('missing_brand')
  if (!row.image_url && images.length === 0) issues.push('missing_image')
  return {
    ...row,
    price: { mode: row.price_mode || 'request', amount: row.price_amount === null ? null : Number(row.price_amount), old_amount: row.old_price_amount === null ? null : Number(row.old_price_amount), currency: row.currency || CURRENCY },
    seo: {
      ru: { title: row.seo_title_ru || '', description: row.seo_description_ru || '' },
      kk: { title: row.seo_title_kk || '', description: row.seo_description_kk || '' },
    },
    images,
    attributes: values.map((value) => ({
      id: value.id,
      attribute_id: value.attribute_id,
      value_text_ru: value.value_text_ru ?? null,
      value_text_kk: value.value_text_kk ?? null,
      value_number: value.value_number ?? null,
      value_boolean: value.value_boolean ?? null,
      value_option: value.value_option ?? null,
      raw_value: value.raw_value ?? null,
      attribute: Array.isArray(value.attribute) ? value.attribute[0] : value.attribute,
    })),
    quality_issues: issues,
  }
}

export function revalidateCatalog() {
  revalidateTag('catalog', 'max')
  revalidateTag('catalog:products', 'max')
  revalidateTag('catalog:categories', 'max')
  revalidateTag('catalog:brands', 'max')
  revalidateTag('catalog:attributes', 'max')
  revalidatePath('/ru/catalog', 'page')
  revalidatePath('/kk/catalog', 'page')
  revalidatePath('/ru/product/[slug]', 'page')
  revalidatePath('/kk/product/[slug]', 'page')
  revalidatePath('/ru/catalog/[categorySlug]', 'page')
  revalidatePath('/kk/catalog/[categorySlug]', 'page')
  revalidatePath('/ru/brands/[brandSlug]', 'page')
  revalidatePath('/kk/brands/[brandSlug]', 'page')
}

export function safeQueryText(value) {
  return value.replace(/[(),]/g, ' ').replace(/[%_]/g, '').trim()
}

export function publicStoragePath(publicUrl) {
  const marker = '/storage/v1/object/public/product-images/'
  if (typeof publicUrl !== 'string' || !publicUrl.includes(marker)) return null
  const path = decodeURIComponent(publicUrl.split(marker)[1] || '')
  if (!path || path.includes('..') || path.startsWith('/')) return null
  return path
}

export function databaseError(operation, error) {
  console.error(`Admin catalog ${operation} failed`, { code: error?.code, status: error?.status })
  return new AdminCatalogValidationError('Unable to save catalog data', 500)
}

export async function validateProductRelations(supabase, product) {
  if (!product.category_id) {
    if (product.publication_status === 'published') fail('category_id is required for published products')
  } else {
    const { data, error } = await supabase.from('categories').select('id,name_ru,status').eq('id', product.category_id).maybeSingle()
    if (error) throw databaseError('category lookup', error)
    if (!data) fail('category_id does not exist')
    if (product.publication_status === 'published' && data.status !== 'published') fail('published products require a published category')
  }
  if (product.brand_id) {
    const { data, error } = await supabase.from('brands').select('id').eq('id', product.brand_id).maybeSingle()
    if (error) throw databaseError('brand lookup', error)
    if (!data) fail('brand_id does not exist')
  }
}

export async function assertNoCategoryCycle(supabase, id, parentId) {
  const seen = new Set()
  let current = parentId
  while (current) {
    if (current === id || seen.has(current)) throw new AdminCatalogValidationError('parent_id would create a category cycle')
    seen.add(current)
    const { data, error } = await supabase.from('categories').select('parent_id').eq('id', current).maybeSingle()
    if (error) throw databaseError('category ancestry', error)
    if (!data) throw new AdminCatalogValidationError('parent_id does not exist')
    current = data.parent_id
  }
}

export async function productDatabaseRow(supabase, product, existing = null) {
  await validateProductRelations(supabase, product)
  let legacyCategory = existing?.category || 'Без категории'
  if (product.category_id) {
    const { data, error } = await supabase.from('categories').select('name_ru').eq('id', product.category_id).single()
    if (error) throw databaseError('category name lookup', error)
    legacyCategory = data.name_ru
  }
  return {
    name: product.name_ru,
    category: legacyCategory,
    description: product.description_ru,
    sort_order: product.sort_order,
    sku: product.sku,
    external_id: product.external_id,
    slug: product.slug,
    category_id: product.category_id,
    brand_id: product.brand_id,
    name_ru: product.name_ru,
    name_kk: product.name_kk,
    short_description_ru: product.short_description_ru,
    short_description_kk: product.short_description_kk,
    description_ru: product.description_ru,
    description_kk: product.description_kk,
    warranty_ru: product.warranty_ru,
    warranty_kk: product.warranty_kk,
    price_mode: product.price.mode,
    price_amount: product.price.amount,
    old_price_amount: product.price.old_amount,
    currency: CURRENCY,
    stock_status: product.stock_status,
    publication_status: product.publication_status,
    publish_ru: product.publish_ru,
    publish_kk: product.publish_kk,
    translation_status_kk: product.translation_status_kk,
    is_featured: product.is_featured,
    seo_title_ru: product.seo.ru.title,
    seo_title_kk: product.seo.kk.title,
    seo_description_ru: product.seo.ru.description,
    seo_description_kk: product.seo.kk.description,
  }
}

export async function enrichAndValidateProductAttributes(supabase, attributes) {
  if (!attributes || !Array.isArray(attributes) || attributes.length === 0) return attributes || []

  const attrIds = [...new Set(attributes.map((a) => a.attribute_id).filter(Boolean))]
  if (attrIds.length === 0) return []

  const { data: dbAttrs, error } = await supabase
    .from('attributes')
    .select('id, data_type, options, status')
    .in('id', attrIds)

  if (error) {
    throw databaseError('attribute metadata lookup', error)
  }

  const dbMap = new Map((dbAttrs || []).map((a) => [a.id, a]))

  return attributes.map((entry, index) => {
    const dbAttr = dbMap.get(entry.attribute_id)
    if (!dbAttr) {
      fail(`attributes[${index}].attribute_id does not exist`)
    }
    if (dbAttr.status !== 'published') {
      fail(`attributes[${index}].attribute_id is inactive`)
    }

    const actualType = dbAttr.data_type
    let valueTextRu = null
    let valueTextKk = null
    let valueNumber = null
    let valueBoolean = null
    let valueOption = null

    if (actualType === 'text') {
      valueTextRu = entry.value_text_ru ?? null
      valueTextKk = entry.value_text_kk ?? null
    } else if (actualType === 'number') {
      valueNumber = entry.value_number === null || entry.value_number === undefined || entry.value_number === '' ? null : Number(entry.value_number)
      if (valueNumber !== null && (!Number.isFinite(valueNumber) || valueNumber < -1000000000 || valueNumber > 1000000000)) {
        fail(`attributes[${index}].value_number must be a finite number within bounds`)
      }
    } else if (actualType === 'boolean') {
      if (entry.value_boolean !== null && entry.value_boolean !== undefined) {
        if (typeof entry.value_boolean !== 'boolean') fail(`attributes[${index}].value_boolean must be a real boolean, not a string`)
        valueBoolean = entry.value_boolean
      }
    } else if (actualType === 'option') {
      valueOption = entry.value_option ? String(entry.value_option).trim() : null
      if (valueOption) {
        if (!Array.isArray(dbAttr.options) || dbAttr.options.length === 0 || dbAttr.options.some((option) => typeof option !== 'string')) {
          fail(`attributes[${index}] configured as option but has no options in database`)
        }
        if (!dbAttr.options.includes(valueOption)) {
          fail(`attributes[${index}].value_option '${valueOption}' is not in allowed options: ${dbAttr.options.join(', ')}`)
        }
      }
    }

    return {
      attribute_id: entry.attribute_id,
      value_text_ru: valueTextRu,
      value_text_kk: valueTextKk,
      value_number: valueNumber,
      value_boolean: valueBoolean,
      value_option: valueOption,
      raw_value: entry.raw_value ?? null,
    }
  })
}

export async function saveCMSProductAtomic(supabase, id, row, attributes) {
  const enrichedAttributes = attributes ? await enrichAndValidateProductAttributes(supabase, attributes) : null

  const { data, error } = await supabase.rpc('save_cms_product_attributes', {
    p_product_id: id,
    p_product_data: row,
    p_attributes: enrichedAttributes ?? null,
  })

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('function')) {
      throw new AdminCatalogValidationError('CMS schema not ready. Atomic RPC save_cms_product_attributes is required.', 503)
    }
    throw databaseError('atomic product save', error)
  }

  return data
}
