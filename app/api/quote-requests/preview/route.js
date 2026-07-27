import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isUUID } from '@/lib/domain-contracts.mjs'

const PREVIEW_SELECT = 'id,slug,sku,name_ru,name_kk,image_url,price_mode,price_amount,old_price_amount,currency,stock_status,publication_status,publish_ru,publish_kk,translation_status_kk'

export async function GET(request) {
  const url = new URL(request.url)
  const locale = url.searchParams.get('locale')
  const ids = [...new Set((url.searchParams.get('ids') || '').split(',').map((id) => id.trim()).filter(Boolean))]
  if (!['ru', 'kk'].includes(locale) || ids.length === 0 || ids.length > 50 || ids.some((id) => !isUUID(id))) {
    return NextResponse.json({ error: 'Invalid preview parameters' }, { status: 400 })
  }

  try {
    const publishField = locale === 'kk' ? 'publish_kk' : 'publish_ru'
    let query = createServerClient()
      .from('products')
      .select(PREVIEW_SELECT)
      .eq('publication_status', 'published')
      .eq(publishField, true)
      .eq('currency', 'KZT')
      .in('id', ids)
    if (locale === 'kk') query = query.eq('translation_status_kk', 'verified')
    const { data, error } = await query
    if (error) {
      console.error('Quote preview failed', { code: error.code, status: error.status })
      return NextResponse.json({ error: 'Unable to load request items' }, { status: 500 })
    }

    const items = (data || []).map((product) => ({
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: locale === 'kk' ? product.name_kk : product.name_ru,
      image_url: typeof product.image_url === 'string' && /^https?:\/\//i.test(product.image_url) ? product.image_url : null,
      price: {
        mode: product.price_mode,
        amount: product.price_amount === null || product.price_amount === undefined ? null : Number(product.price_amount),
        old_amount: product.old_price_amount === null || product.old_price_amount === undefined ? null : Number(product.old_price_amount),
        currency: 'KZT',
      },
      stock_status: product.stock_status,
    }))
    return NextResponse.json(items, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } })
  } catch (error) {
    console.error('Quote preview crashed', { code: error?.code, status: error?.status })
    return NextResponse.json({ error: 'Unable to load request items' }, { status: 500 })
  }
}
