import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, revalidateCatalog, validateBrandCMSPayload } from '@/lib/admin-catalog.mjs'

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog brands route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { data, error } = await auth.supabase.from('brands').select('*').order('sort_order').order('name')
    if (error) throw databaseError('brands list', error)
    return NextResponse.json({ items: data || [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const brand = validateBrandCMSPayload(await readJsonBody(request))
    const { data, error } = await auth.supabase.from('brands').insert(brand).select('id').single()
    if (error) throw databaseError('brand create', error)
    revalidateCatalog()
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
