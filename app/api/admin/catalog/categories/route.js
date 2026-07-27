import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { readJsonBody } from '@/lib/request-validation'
import {
  AdminCatalogValidationError,
  assertNoCategoryCycle,
  databaseError,
  revalidateCatalog,
  validateCategoryCMSPayload,
} from '@/lib/admin-catalog.mjs'

function errorResponse(error) {
  if (error instanceof AdminCatalogValidationError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Admin catalog categories route crashed', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { data, error } = await auth.supabase.from('categories').select('*').order('sort_order').order('name_ru')
    if (error) throw databaseError('categories list', error)
    return NextResponse.json({ items: data || [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const category = validateCategoryCMSPayload(await readJsonBody(request))
    await assertNoCategoryCycle(auth.supabase, null, category.parent_id)
    const row = {
      ...category,
      seo_title_ru: category.seo.ru.title,
      seo_title_kk: category.seo.kk.title,
      seo_description_ru: category.seo.ru.description,
      seo_description_kk: category.seo.kk.description,
    }
    delete row.seo
    const { data, error } = await auth.supabase.from('categories').insert(row).select('id').single()
    if (error) throw databaseError('category create', error)
    revalidateCatalog()
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
