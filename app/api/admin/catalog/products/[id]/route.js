import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import {
  AdminCatalogValidationError,
  PRODUCT_ADMIN_SELECT,
  databaseError,
  normalizeAdminProduct,
  productDatabaseRow,
  revalidateCatalog,
  saveCMSProductAtomic,
  syncProductAttributes,
  validateProductCMSPayload,
} from '@/lib/admin-catalog.mjs'

async function productId(params) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AdminCatalogValidationError('id must be a UUID')
  }
  return id
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog product route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await productId(params)
    const { data, error } = await auth.supabase.from('products').select(PRODUCT_ADMIN_SELECT).eq('id', id).maybeSingle()
    if (error) throw databaseError('product detail', error)
    if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    return NextResponse.json(normalizeAdminProduct(data))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await productId(params)
    const { data: existing, error: existingError } = await auth.supabase.from('products').select('*').eq('id', id).maybeSingle()
    if (existingError) throw databaseError('product lookup', existingError)
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const product = validateProductCMSPayload(await readJsonBody(request, 64 * 1024))
    const row = await productDatabaseRow(auth.supabase, product, existing)
    await saveCMSProductAtomic(auth.supabase, id, row, product.attributes)
    revalidateCatalog()
    return NextResponse.json({ id })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await productId(params)
    const { data, error } = await auth.supabase.from('products').update({ publication_status: 'archived', publish_ru: false, publish_kk: false }).eq('id', id).select('id').maybeSingle()
    if (error) throw databaseError('product archive', error)
    if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    revalidateCatalog()
    return NextResponse.json({ id, status: 'archived' })
  } catch (error) {
    return errorResponse(error)
  }
}
