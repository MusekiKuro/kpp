import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, revalidateCatalog } from '@/lib/admin-catalog.mjs'

async function routeIds(params) {
  const { id, imageId } = await params
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id) || !uuid.test(imageId)) throw new AdminCatalogValidationError('id and imageId must be UUIDs')
  return { id, imageId }
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog gallery image route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id, imageId } = await routeIds(params)
    const body = await readJsonBody(request)
    const sortOrder = body?.sort_order
    const isPrimary = body?.is_primary

    if (sortOrder !== undefined && (!Number.isSafeInteger(sortOrder) || sortOrder < 0)) {
      throw new AdminCatalogValidationError('sort_order is invalid')
    }
    if (isPrimary !== undefined && typeof isPrimary !== 'boolean') {
      throw new AdminCatalogValidationError('is_primary is invalid')
    }

    if (isPrimary === true) {
      const { error: rpcError } = await auth.supabase.rpc('set_primary_product_image', {
        p_product_id: id,
        p_image_id: imageId,
      })
      if (rpcError) {
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function')) {
          throw new AdminCatalogValidationError('CMS schema not ready. RPC set_primary_product_image is required.', 503)
        }
        throw databaseError('set primary image', rpcError)
      }
    } else if (isPrimary === false) {
      throw new AdminCatalogValidationError('Cannot unset primary image directly. Set another image as primary instead.')
    }

    if (sortOrder !== undefined) {
      const { error: updateError } = await auth.supabase.from('product_images').update({ sort_order: sortOrder }).eq('id', imageId).eq('product_id', id)
      if (updateError) throw databaseError('update sort order', updateError)
      const { error: invError } = await auth.supabase.rpc('ensure_product_primary_image_invariant', { p_product_id: id })
      if (invError && invError.code !== 'PGRST202') throw databaseError('primary invariant check', invError)
    }

    const { data, error } = await auth.supabase.from('product_images').select('*').eq('id', imageId).eq('product_id', id).maybeSingle()
    if (error) throw databaseError('gallery query', error)
    if (!data) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    revalidateCatalog()
    return NextResponse.json(data)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id, imageId } = await routeIds(params)

    const { data: deleteResult, error: deleteError } = await auth.supabase.rpc('delete_product_image', {
      p_product_id: id,
      p_image_id: imageId
    })

    if (deleteError) {
      if (deleteError.code === 'P0002') return NextResponse.json({ id: imageId, status: 'deleted' }, { status: 200 })
      throw databaseError('gallery delete RPC', deleteError)
    }

    revalidateCatalog()
    return NextResponse.json({
      id: imageId,
      status: 'deleted',
      cleanup_status: deleteResult?.cleanup_job_id ? 'queued' : 'not_required',
    }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
