import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const { data, error } = await auth.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from('orders')
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

export async function POST(request) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { customer_name, customer_phone, customer_message, items } = body

    if (!customer_name || !customer_phone || !items?.length) {
      return NextResponse.json(
        { error: 'Имя, телефон и товары обязательны' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name,
        customer_phone,
        customer_message: customer_message || '',
        items,
        status: 'new',
      })
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

export async function PUT(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID и статус обязательны' },
        { status: 400 }
      )
    }

    const { data, error } = await auth.supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
