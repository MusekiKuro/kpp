import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import { AdminCatalogValidationError, databaseError, revalidateCatalog, validateAttributeCMSPayload } from '@/lib/admin-catalog.mjs'

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog attributes route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { data, error } = await auth.supabase.from('attributes').select('*').order('sort_order').order('code')
    if (error) throw databaseError('attributes list', error)
    return NextResponse.json({ items: data || [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const attribute = validateAttributeCMSPayload(await readJsonBody(request))
    const { data, error } = await auth.supabase.from('attributes').insert(attribute).select('id').single()
    if (error) throw databaseError('attribute create', error)
    revalidateCatalog()
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
