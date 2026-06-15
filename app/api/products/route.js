import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { name, category, description, image_url, sort_order } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Название товара обязательно' }, { status: 400 })
    }
    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Категория обязательна' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('products')
      .insert({ name: name.trim(), category: category.trim(), description, image_url, sort_order })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
