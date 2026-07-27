import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import { removeProductImage } from '@/lib/storage'
import {
  isUUID,
  readJsonBody,
  RequestValidationError,
  validateProductPayload,
} from '@/lib/request-validation'

function logDatabaseError(operation, error) {
  console.error(`Product API ${operation} failed:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
  })
}

async function getId(params) {
  const { id } = await params
  if (!isUUID(id)) throw new RequestValidationError('id must be a UUID')
  return id
}

import { toPublicProductDTO } from '@/lib/catalog/dto.mjs'

export async function GET(request, { params }) {
  try {
    const id = await getId(params)
    const { data, error } = await createServerClient()
      .from('public_products')
      .select('id,slug,sku,name_ru,name_kk,short_description_ru,short_description_kk,description_ru,description_kk,price_mode,price_amount,old_price_amount,currency,stock_status,image_url,category_id,brand_id,is_featured,sort_order')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    return NextResponse.json(toPublicProductDTO(data, 'ru'))
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 })
    }
    console.error('Product API GET crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const id = await getId(params)
    const { data: existing, error: existingError } = await auth.supabase
      .from('products')
      .select('image_url')
      .eq('id', id)
      .single()
    if (existingError || !existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const updates = validateProductPayload(await readJsonBody(request), { partial: true })
    const { data, error } = await auth.supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logDatabaseError('PUT', error)
      return NextResponse.json({ error: 'Unable to update product' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (existing.image_url && existing.image_url !== data.image_url) {
      await removeProductImage(auth.supabase, existing.image_url)
    }
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 })
    }
    console.error('Product API PUT crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const id = await getId(params)
    const { data: existing, error: existingError } = await auth.supabase
      .from('products')
      .select('image_url')
      .eq('id', id)
      .single()
    if (existingError || !existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const { error, count } = await auth.supabase
      .from('products')
      .delete({ count: 'exact' })
      .eq('id', id)

    if (error) {
      logDatabaseError('DELETE', error)
      return NextResponse.json({ error: 'Unable to delete product' }, { status: 500 })
    }
    if (count === 0) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (existing.image_url) await removeProductImage(auth.supabase, existing.image_url)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 })
    }
    console.error('Product API DELETE crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
