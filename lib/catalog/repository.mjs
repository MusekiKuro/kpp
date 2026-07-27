import { isLocale } from '../i18n/config.js'
import { createServerClient } from '../supabase-server.js'
import { CATALOG_CACHE_TAGS, catalogCacheTags } from './cache-tags.mjs'
import {
  catalogQueryKey,
  CatalogQueryValidationError,
  parseCatalogQuery,
  validateCatalogSlug,
} from './query-parser.mjs'
import { CatalogDTOError, toPublicBrandDTO, toPublicCategoryDTO, toPublicProductDTO } from './dto.mjs'
import { toPublicProductDetailDTO } from './dto.mjs'
import { isUUID } from '../domain-contracts.mjs'

let unstable_cache
try {
  const mod = await import('next/cache')
  unstable_cache = mod.unstable_cache
} catch {
  unstable_cache = null
}

const CACHE_REVALIDATE_SECONDS = 300

const MAX_ATTRIBUTE_MATCH_IDS = 5000

const CATEGORY_SELECT = [
  'id',
  'parent_id',
  'slug',
  'name_ru',
  'name_kk',
  'description_ru',
  'description_kk',
  'sort_order',
  'status',
].join(',')

const BRAND_SELECT = [
  'id',
  'slug',
  'name',
  'description_ru',
  'description_kk',
  'logo_url',
  'website_url',
  'sort_order',
  'status',
].join(',')

const ATTRIBUTE_SELECT = ['id', 'code', 'data_type', 'is_filterable', 'status'].join(',')

const PRODUCT_SELECT = [
  'id',
  'slug',
  'sku',
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
  'image_url',
  'category_id',
  'brand_id',
  'is_featured',
  'sort_order',
  'created_at',
  'category:categories!inner(id,slug,name_ru,name_kk,status,parent_id,sort_order)',
  'brand:brands(id,slug,name,description_ru,description_kk,logo_url,website_url,status,sort_order)',
].join(',')



export class CatalogRepositoryError extends Error {
  constructor(message = 'Catalog data is temporarily unavailable') {
    super(message)
    this.name = 'CatalogRepositoryError'
    this.code = 'CATALOG_QUERY_FAILED'
    this.status = 500
  }
}

function assertLocale(locale) {
  if (!isLocale(locale)) {
    throw new CatalogQueryValidationError('locale', 'must be ru or kk')
  }
  return locale
}

function logQueryFailure(operation, error) {
  console.error(`Catalog query ${operation} failed`, {
    code: error?.code,
    status: error?.status,
  })
}

function throwDatabaseError(operation, error) {
  logQueryFailure(operation, error)
  throw new CatalogRepositoryError()
}

function localizedNameField(locale) {
  return locale === 'kk' ? 'name_kk' : 'name_ru'
}

function localizedDescriptionField(locale) {
  return locale === 'kk' ? 'description_kk' : 'description_ru'
}

function createCachedQuery(keyParts, tags, callback) {
  if (typeof unstable_cache === 'function') {
    try {
      return unstable_cache(callback, keyParts, {
        tags,
        revalidate: CACHE_REVALIDATE_SECONDS,
      })()
    } catch {
      return callback()
    }
  }
  return callback()
}


async function loadPublishedCategoryRows(locale) {
  const nameField = localizedNameField(locale)
  return createCachedQuery(
    ['catalog-categories', locale],
    catalogCacheTags(locale, CATALOG_CACHE_TAGS.categories),
    async () => {
      const { data, error } = await createServerClient()
        .from('categories')
        .select(CATEGORY_SELECT)
        .eq('status', 'published')
        .not(nameField, 'is', null)
        .neq(nameField, '')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('slug', { ascending: true })

      if (error) throwDatabaseError('categories', error)
      return data || []
    }
  )
}

async function loadPublishedBrandRows(locale) {
  return createCachedQuery(
    ['catalog-brands', locale],
    catalogCacheTags(locale, CATALOG_CACHE_TAGS.brands),
    async () => {
      const { data, error } = await createServerClient()
        .from('brands')
        .select(BRAND_SELECT)
        .eq('status', 'published')
        .not('name', 'is', null)
        .neq('name', '')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
        .order('id', { ascending: true })

      if (error) throwDatabaseError('brands', error)
      return data || []
    }
  )
}

async function resolveCategoryIds(locale, categorySlug) {
  if (!categorySlug) return null

  const rows = await loadPublishedCategoryRows(locale)
  const selected = rows.find((row) => row.slug === categorySlug)
  if (!selected) return []

  const ids = new Set([selected.id])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    }
  }
  return [...ids]
}

async function resolveBrandId(locale, brandSlug) {
  if (!brandSlug) return null
  const rows = await loadPublishedBrandRows(locale)
  return rows.find((row) => row.slug === brandSlug)?.id || false
}

async function resolveAttributeProductIds(locale, attributes) {
  const codes = Object.keys(attributes)
  if (codes.length === 0) return null

  const { data: attributeRows, error: attributeError } = await createServerClient()
    .from('attributes')
    .select(ATTRIBUTE_SELECT)
    .eq('is_filterable', true)
    .eq('status', 'published')
    .in('code', codes)

  if (attributeError) throwDatabaseError('attributes', attributeError)

  const byCode = new Map((attributeRows || []).map((row) => [row.code, row]))
  for (const code of codes) {
    const attribute = byCode.get(code)
    if (!attribute) {
      throw new CatalogQueryValidationError(`attr.${code}`, 'is not a published filterable attribute')
    }

    const rawValue = attributes[code]
    if (attribute.data_type === 'boolean') {
      if (rawValue !== 'true' && rawValue !== 'false') {
        throw new CatalogQueryValidationError(`attr.${code}`, 'must be true or false')
      }
    } else if (attribute.data_type === 'number') {
      if (!/^\d+(?:\.\d{1,4})?$/.test(rawValue)) {
        throw new CatalogQueryValidationError(`attr.${code}`, 'must be a non-negative number')
      }
    }
  }

  const { data, error } = await createServerClient().rpc('get_published_product_ids_by_attributes', {
    p_locale: locale,
    p_filters: attributes,
  })

  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      const schemaError = new CatalogRepositoryError('CMS schema not ready')
      schemaError.status = 503
      throw schemaError
    }
    if (error.code === '22023') {
      throw new CatalogQueryValidationError('attributes', 'contain an invalid public filter')
    }
    if (error.code === '54000') {
      throw new CatalogRepositoryError('Catalog filter is too broad')
    }
    throwDatabaseError('attribute filters', error)
  }

  const ids = [...new Set((data || []).map((row) => row.product_id).filter(Boolean))]
  if (ids.length > MAX_ATTRIBUTE_MATCH_IDS) {
    throw new CatalogRepositoryError('Catalog filter is too broad')
  }
  return ids
}

function matchingBrandIds(rows, search) {
  const term = search.toLocaleLowerCase()
  return rows
    .filter((row) => row.name.toLocaleLowerCase().includes(term))
    .map((row) => row.id)
}

function applyProductOrdering(query, filters, nameField) {
  switch (filters.sort) {
    case 'name_asc':
      return query.order(nameField, { ascending: true, nullsFirst: false }).order('id', { ascending: true })
    case 'newest':
      return query.order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true })
    case 'price_asc':
      return query
        .in('price_mode', ['exact', 'from'])
        .not('price_amount', 'is', null)
        .order('price_amount', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
    case 'price_desc':
      return query
        .in('price_mode', ['exact', 'from'])
        .not('price_amount', 'is', null)
        .order('price_amount', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
    case 'recommended':
    default:
      return query
        .order('is_featured', { ascending: false, nullsFirst: false })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
  }
}

async function executeProductPage(locale, filters, categoryIds, brandId, attributeProductIds, brandSearchIds) {
  const nameField = localizedNameField(locale)
  const searchPattern = filters.q ? `*${filters.q}*` : null
  let query = createServerClient()
    .from('public_products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('currency', 'KZT')
    .not('slug', 'is', null)
    .not('category_id', 'is', null)
    .not(nameField, 'is', null)
    .neq(nameField, '')
    .eq('category.status', 'published')

  if (categoryIds) {
    if (categoryIds.length === 0) return { data: [], count: 0 }
    query = query.in('category_id', categoryIds)
  }
  if (brandId) query = query.eq('brand_id', brandId)
  if (brandId === false) return { data: [], count: 0 }
  if (attributeProductIds) {
    if (attributeProductIds.length === 0) return { data: [], count: 0 }
    query = query.in('id', attributeProductIds)
  }
  if (filters.stock) query = query.eq('stock_status', filters.stock)
  if (filters.price_mode) query = query.eq('price_mode', filters.price_mode)
  if (filters.min_price !== null) {
    query = query.in('price_mode', ['exact', 'from']).gte('price_amount', filters.min_price)
  }
  if (filters.max_price !== null) {
    query = query.in('price_mode', ['exact', 'from']).lte('price_amount', filters.max_price)
  }
  if (searchPattern) {
    const searchTerms = [
      `${nameField}.ilike.${searchPattern}`,
      `sku.ilike.${searchPattern}`,
    ]
    if (brandSearchIds.length > 0) searchTerms.push(`brand_id.in.(${brandSearchIds.join(',')})`)
    query = query.or(searchTerms.join(','))
  }

  query = applyProductOrdering(query, filters, nameField)
  const from = (filters.page - 1) * filters.page_size
  const to = from + filters.page_size - 1
  const { data, error, count } = await query.range(from, to)
  if (error) throwDatabaseError('products', error)
  return { data: data || [], count: count || 0 }
}

export async function getPublishedCategories(locale) {
  const normalizedLocale = assertLocale(locale)
  const rows = await loadPublishedCategoryRows(normalizedLocale)
  try {
    return rows.map((row) => toPublicCategoryDTO(row, normalizedLocale))
  } catch (error) {
    if (error instanceof CatalogDTOError) throw new CatalogRepositoryError()
    throw error
  }
}

export async function getPublishedBrands(locale) {
  const normalizedLocale = assertLocale(locale)
  const rows = await loadPublishedBrandRows(normalizedLocale)
  try {
    return rows.map((row) => toPublicBrandDTO(row, normalizedLocale))
  } catch (error) {
    if (error instanceof CatalogDTOError) throw new CatalogRepositoryError()
    throw error
  }
}

export async function getPublishedProducts({ locale, searchParams }) {
  const normalizedLocale = assertLocale(locale)
  const filters = parseCatalogQuery(searchParams)
  const categoryIds = await resolveCategoryIds(normalizedLocale, filters.category)
  const brandId = await resolveBrandId(normalizedLocale, filters.brand)
  const attributeProductIds = await resolveAttributeProductIds(normalizedLocale, filters.attributes)
  const brandRows = filters.q ? await loadPublishedBrandRows(normalizedLocale) : []
  const brandSearchIds = filters.q ? matchingBrandIds(brandRows, filters.q) : []

  const key = catalogQueryKey(filters)
  const result = await createCachedQuery(
    ['catalog-products', normalizedLocale, key, JSON.stringify({ categoryIds, brandId, attributeProductIds, brandSearchIds })],
    catalogCacheTags(normalizedLocale, CATALOG_CACHE_TAGS.products),
    () => executeProductPage(normalizedLocale, filters, categoryIds, brandId, attributeProductIds, brandSearchIds)
  )

  try {
    const items = result.data.map((row) => toPublicProductDTO(row, normalizedLocale))
    const total = result.count
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.page_size)
    return {
      items,
      pagination: {
        page: filters.page,
        page_size: filters.page_size,
        total,
        total_pages: totalPages,
        has_previous: filters.page > 1,
        has_next: totalPages > filters.page,
      },
      filters,
    }
  } catch (error) {
    if (error instanceof CatalogDTOError) throw new CatalogRepositoryError()
    throw error
  }
}

export async function getPublishedProductBySlug({ locale, slug }) {
  const normalizedLocale = assertLocale(locale)
  const normalizedSlug = validateCatalogSlug(slug)

  const data = await createCachedQuery(
    ['catalog-product-detail-rpc', normalizedLocale, normalizedSlug],
    catalogCacheTags(normalizedLocale, CATALOG_CACHE_TAGS.products),
    async () => {
      const { data: rpcData, error: rpcError } = await createServerClient().rpc('get_published_product_detail', {
        p_locale: normalizedLocale,
        p_slug: normalizedSlug,
      })

      if (rpcError) {
        if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
          const err = new CatalogRepositoryError('CMS schema not ready')
          err.status = 503
          throw err
        }
        throwDatabaseError('product-detail', rpcError)
      }

      return rpcData || null
    }
  )

  if (!data) return null
  try {
    return toPublicProductDetailDTO(data, normalizedLocale, {
      storageBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    })
  } catch (error) {
    if (error instanceof CatalogDTOError) throw new CatalogRepositoryError()
    throw error
  }
}

export async function getPublishedProductById({ locale, id }) {
  const normalizedLocale = assertLocale(locale)
  if (!isUUID(id)) return null

  const nameField = localizedNameField(normalizedLocale)
  const row = await createCachedQuery(
    ['catalog-product-id', normalizedLocale, id],
    catalogCacheTags(normalizedLocale, CATALOG_CACHE_TAGS.products),
    async () => {
      // 1. Try get_published_product_slug RPC
      const { data: rpcData, error: rpcError } = await createServerClient().rpc('get_published_product_slug', {
        p_locale: normalizedLocale,
        p_id: id,
      })

      if (rpcError) {
        if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
          const err = new CatalogRepositoryError('CMS schema not ready')
          err.status = 503
          throw err
        }
        throwDatabaseError('product-id', rpcError)
      }

      if (Array.isArray(rpcData) && rpcData.length > 0) {
        return { id: rpcData[0].id, slug: rpcData[0].slug }
      }

      return null
    }
  )

  if (!row) return null
  return { id: row.id, slug: row.slug }
}
