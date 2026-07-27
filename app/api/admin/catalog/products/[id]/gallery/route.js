import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, publicStoragePath, revalidateCatalog } from '@/lib/admin-catalog.mjs'

const URL_RE = /^https?:\/\//i

async function ids(params) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AdminCatalogValidationError('id must be a UUID')
  return id
}

function text(value, field, max = 2000) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.trim().length > max) throw new AdminCatalogValidationError(`${field} is invalid`)
  return value.trim() || null
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog gallery route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const productId = await ids(params)
    const { data, error } = await auth.supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order').order('id')
    if (error) throw databaseError('gallery list', error)
    return NextResponse.json({ items: data || [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const productId = await ids(params)
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminCatalogValidationError('gallery payload must be an object')
    const sourceUrl = text(body.source_url, 'source_url', 2048)
    const storagePath = publicStoragePath(sourceUrl)
    if (!sourceUrl || !URL_RE.test(sourceUrl) || !storagePath) throw new AdminCatalogValidationError('source_url must be an uploaded product image')
    const sortOrder = Number.isSafeInteger(body.sort_order) && body.sort_order >= 0 ? body.sort_order : 0
    if (body.is_primary !== undefined && typeof body.is_primary !== 'boolean') {
      throw new AdminCatalogValidationError('is_primary must be boolean')
    }

    const { data: createResult, error: createError } = await auth.supabase.rpc('create_product_image', {
      p_product_id: productId,
      p_image_data: {
        storage_path: storagePath,
        source_url: sourceUrl,
        alt_ru: text(body.alt_ru, 'alt_ru'),
        alt_kk: text(body.alt_kk, 'alt_kk'),
        sort_order: sortOrder,
        is_primary: body.is_primary === true,
      }
    })

    if (createError) {
      if (createError.code === 'PGRST202' || createError.code === '42883') {
        throw new AdminCatalogValidationError('CMS schema not ready. RPC create_product_image is required.', 503)
      }
      throw databaseError('gallery create RPC', createError)
    }

    // Fetch the inserted record to return to client
    const { data, error } = await auth.supabase.from('product_images').select('*').eq('id', createResult.id).single()
    if (error) throw databaseError('fetch created image', error)

    revalidateCatalog()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
