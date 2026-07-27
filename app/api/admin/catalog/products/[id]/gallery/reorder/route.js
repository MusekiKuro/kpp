import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, revalidateCatalog } from '@/lib/admin-catalog.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function productId(params) {
  const { id } = await params
  if (!UUID_RE.test(id)) throw new AdminCatalogValidationError('id must be a UUID')
  return id
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog gallery reorder route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await productId(params)
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object' || !Array.isArray(body.image_ids)) {
      throw new AdminCatalogValidationError('image_ids must be an array of UUIDs')
    }
    const imageIds = body.image_ids
    if (imageIds.length > 100) throw new AdminCatalogValidationError('Cannot reorder more than 100 images at once')
    for (const imageId of imageIds) {
      if (!UUID_RE.test(imageId)) throw new AdminCatalogValidationError('All image_ids must be valid UUIDs')
    }

    if (new Set(imageIds).size !== imageIds.length) {
      throw new AdminCatalogValidationError('image_ids must not contain duplicates')
    }

    // Validate that image_ids matches the exact list of existing images for this product
    const { data: existingImages, error: listError } = await auth.supabase
      .from('product_images')
      .select('id')
      .eq('product_id', id)

    if (listError) throw databaseError('gallery lookup for reorder', listError)

    const dbIds = (existingImages || []).map((img) => img.id)
    if (dbIds.length !== imageIds.length) {
      throw new AdminCatalogValidationError('image_ids must contain a unique complete list of image IDs for this product')
    }

    const dbSet = new Set(dbIds)
    for (const imgId of imageIds) {
      if (!dbSet.has(imgId)) {
        throw new AdminCatalogValidationError('image_ids contains invalid or foreign image IDs')
      }
    }

    const { error: rpcError } = await auth.supabase.rpc('reorder_product_images', {
      p_product_id: id,
      p_image_ids: imageIds,
    })

    if (rpcError) {
      if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function')) {
        throw new AdminCatalogValidationError('CMS schema not ready. RPC reorder_product_images is required.', 503)
      }
      throw databaseError('gallery reorder', rpcError)
    }

    revalidateCatalog()
    return NextResponse.json({ success: true, count: imageIds.length })
  } catch (error) {
    return errorResponse(error)
  }
}
