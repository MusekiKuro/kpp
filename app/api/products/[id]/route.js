import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const body = await request.json()

    const { name, category, description, image_url, sort_order } = body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (category !== undefined) updates.category = category
    if (description !== undefined) updates.description = description
    if (image_url !== undefined) updates.image_url = image_url
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data, error } = await auth.supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const { id } = await params

    const { error } = await auth.supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
