import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import {
  readJsonBody,
  RequestValidationError,
  validateProductPayload,
} from '@/lib/request-validation'

import { toPublicProductDTO } from '@/lib/catalog/dto.mjs'

function logDatabaseError(operation, error) {
  console.error(`Products API ${operation} failed:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
  })
}

export async function GET() {
  try {
    const { data, error } = await createServerClient()
      .from('public_products')
      .select('id,slug,sku,name_ru,name_kk,short_description_ru,short_description_kk,description_ru,description_kk,price_mode,price_amount,old_price_amount,currency,stock_status,image_url,category_id,brand_id,is_featured,sort_order,created_at')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      logDatabaseError('GET', error)
      return NextResponse.json({ error: 'Unable to load products' }, { status: 500 })
    }

    const safeData = (data || []).map((row) => toPublicProductDTO(row, 'ru'))
    return NextResponse.json(safeData)
  } catch (error) {
    console.error('Products API GET crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const product = validateProductPayload(await readJsonBody(request))
    const { data, error } = await auth.supabase
      .from('products')
      .insert(product)
      .select()
      .single()

    if (error) {
      logDatabaseError('POST', error)
      return NextResponse.json({ error: 'Unable to create product' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 })
    }
    console.error('Products API POST crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
