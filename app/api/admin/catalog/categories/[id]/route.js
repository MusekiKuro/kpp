import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import {
  AdminCatalogValidationError,
  databaseError,
  revalidateCatalog,
  assertNoCategoryCycle,
  validateCategoryCMSPayload,
} from '@/lib/admin-catalog.mjs'

async function idFrom(params) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AdminCatalogValidationError('id must be a UUID')
  return id
}

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog category route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const id = await idFrom(params)
    const category = validateCategoryCMSPayload(await readJsonBody(request))
    await assertNoCategoryCycle(auth.supabase, id, category.parent_id)
    const row = { ...category, seo_title_ru: category.seo.ru.title, seo_title_kk: category.seo.kk.title, seo_description_ru: category.seo.ru.description, seo_description_kk: category.seo.kk.description }
    delete row.seo
    const { data, error } = await auth.supabase.from('categories').update(row).eq('id', id).select('id').maybeSingle()
    if (error) throw databaseError('category update', error)
    if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
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
    const { data, error } = await auth.supabase.from('categories').update({ status: 'archived' }).eq('id', id).select('id').maybeSingle()
    if (error) throw databaseError('category archive', error)
    if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    revalidateCatalog()
    return NextResponse.json({ id, status: 'archived' })
  } catch (error) {
    return errorResponse(error)
  }
}
