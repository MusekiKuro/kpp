import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import {
  AdminCatalogValidationError,
  PRODUCT_ADMIN_SELECT,
  databaseError,
  normalizeAdminProduct,
  parseAdminPageParams,
  productDatabaseRow,
  revalidateCatalog,
  saveCMSProductAtomic,
  safeQueryText,
  syncProductAttributes,
  validateProductCMSPayload,
} from '@/lib/admin-catalog.mjs'

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog products route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const params = parseAdminPageParams(request.nextUrl.searchParams)
    let query = auth.supabase.from('products').select(PRODUCT_ADMIN_SELECT, { count: 'exact' })
    if (params.q) {
      const q = safeQueryText(params.q)
      if (q) query = query.or(`sku.ilike.%${q}%,name_ru.ilike.%${q}%,name_kk.ilike.%${q}%,name.ilike.%${q}%`)
    }
    if (params.status) query = query.eq('publication_status', params.status)
    if (params.categoryId) query = query.eq('category_id', params.categoryId)
    if (params.brandId) query = query.eq('brand_id', params.brandId)
    if (params.priceMode) query = query.eq('price_mode', params.priceMode)
    if (params.translation) query = query.eq('translation_status_kk', params.translation)
    if (params.quality === 'missing_sku') query = query.is('sku', null)
    if (params.quality === 'missing_kz') query = query.or('name_kk.is.null,name_kk.eq.')
    if (params.quality === 'missing_category') query = query.is('category_id', null)
    if (params.quality === 'missing_brand') query = query.is('brand_id', null)
    if (params.quality === 'missing_image') query = query.is('image_url', null)
    const from = (params.page - 1) * params.pageSize
    const { data, error, count } = await query
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .range(from, from + params.pageSize - 1)
    if (error) throw databaseError('products list', error)
    const total = count || 0
    return NextResponse.json({
      items: (data || []).map(normalizeAdminProduct),
      pagination: { page: params.page, page_size: params.pageSize, total, total_pages: total ? Math.ceil(total / params.pageSize) : 0 },
      filters: params,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const product = validateProductCMSPayload(await readJsonBody(request, 64 * 1024))
    const row = await productDatabaseRow(auth.supabase, product)
    const { data, error } = await auth.supabase.from('products').insert(row).select('id').single()
    if (error) throw databaseError('product create', error)

    try {
      await saveCMSProductAtomic(auth.supabase, data.id, row, product.attributes)
    } catch (syncError) {
      await auth.supabase.from('products').delete().eq('id', data.id)
      throw syncError
    }

    revalidateCatalog()
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
