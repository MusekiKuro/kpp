import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import {
  readJsonBody,
  RequestValidationError,
  validateOrderUpdate,
  validateUUIDBody,
} from '@/lib/request-validation'

const ORDER_STATUSES = ['new', 'in_progress', 'done']

function validationResponse(error) {
  return NextResponse.json({ error: error.message }, { status: error.status || 400 })
}

function logDatabaseError(operation, error) {
  console.error(`Orders API ${operation} failed:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
  })
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const { data, error } = await auth.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logDatabaseError('GET', error)
      return NextResponse.json({ error: 'Unable to load orders' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Orders API GET crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const id = validateUUIDBody(await readJsonBody(request))
    const { error } = await auth.supabase.from('orders').delete().eq('id', id)

    if (error) {
      logDatabaseError('DELETE', error)
      return NextResponse.json({ error: 'Unable to delete order' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestValidationError) return validationResponse(error)
    console.error('Orders API DELETE crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint deprecated. Please submit quote requests via /api/quote-requests.' },
    { status: 410 }
  )
}

export async function PUT(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const { id, status } = validateOrderUpdate(await readJsonBody(request), ORDER_STATUSES)
    const { data, error } = await auth.supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logDatabaseError('PUT', error)
      return NextResponse.json({ error: 'Unable to update order' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof RequestValidationError) return validationResponse(error)
    console.error('Orders API PUT crashed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
