import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, revalidateCatalog, validateAttributeCMSPayload } from '@/lib/admin-catalog.mjs'

async function idFrom(params) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AdminCatalogValidationError('id must be a UUID')
  return id
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog attribute route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await idFrom(params)
    const attribute = validateAttributeCMSPayload(await readJsonBody(request))
    const { data, error } = await auth.supabase.from('attributes').update(attribute).eq('id', id).select('id').maybeSingle()
    if (error) throw databaseError('attribute update', error)
    if (!data) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
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
    const id = await idFrom(params)
    const { data, error } = await auth.supabase.from('attributes').update({ status: 'archived' }).eq('id', id).select('id').maybeSingle()
    if (error) throw databaseError('attribute archive', error)
    if (!data) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
    revalidateCatalog()
    return NextResponse.json({ id, status: 'archived' })
  } catch (error) {
    return errorResponse(error)
  }
}
