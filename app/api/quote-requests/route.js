import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import {
  checkRateLimit,
  readJsonBody,
  RequestValidationError,
  validateQuoteAdminUpdate,
  validateQuoteRequestPayload,
} from '@/lib/request-validation'
import {
  buildQuoteCsv,
  buildQuoteSnapshotItems,
  isQuoteSchemaError,
  QUOTE_PRODUCT_SELECT,
  QUOTE_REQUEST_SELECT,
  QuoteProductUnavailableError,
  QuoteSchemaNotReadyError,
} from '@/lib/quote-requests.mjs'
import { requireAdmin } from '@/lib/api-auth'

const MAX_ADMIN_LIMIT = 500
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const quoteIdempotency = globalThis.__nursetQuoteIdempotency || new Map()
globalThis.__nursetQuoteIdempotency = quoteIdempotency

function validationResponse(error) {
  return NextResponse.json({ error: error.message }, { status: error.status || 400 })
}

function safeDatabaseLog(operation, error) {
  console.error(`Quote API ${operation} failed`, { code: error?.code, status: error?.status })
}

function schemaErrorOrOriginal(error) {
  return isQuoteSchemaError(error) ? new QuoteSchemaNotReadyError() : error
}

function sameOriginSourceUrl(value, request) {
  if (!value) return null
  try {
    const candidate = new URL(value)
    const requestUrl = new URL(request.url)
    if (!['http:', 'https:'].includes(candidate.protocol) || candidate.origin !== requestUrl.origin) return null
    return candidate.toString().slice(0, 2048)
  } catch {
    return null
  }
}

function sourceMetadata(input, request) {
  const sourceUrl = sameOriginSourceUrl(input.source_url, request)
    || sameOriginSourceUrl(request.headers.get('referer'), request)
  let sourceParams = null
  try {
    sourceParams = sourceUrl ? new URL(sourceUrl).searchParams : null
  } catch {
    sourceParams = null
  }

  const getUtm = (field) => input[field] || sourceParams?.get(field) || null
  return {
    source_url: sourceUrl,
    utm_source: getUtm('utm_source'),
    utm_medium: getUtm('utm_medium'),
    utm_campaign: getUtm('utm_campaign'),
    utm_term: getUtm('utm_term'),
    utm_content: getUtm('utm_content'),
  }
}

async function loadExistingByIdempotency(supabase, key) {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('id,status')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error) throw schemaErrorOrOriginal(error)
  return data || null
}

async function createQuoteRequest(input, request) {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    throw new QuoteSchemaNotReadyError()
  }

  const existing = await loadExistingByIdempotency(supabase, input.idempotency_key)
  if (existing) return { id: existing.id, status: existing.status, replayed: true }

  const productIds = input.items.map((item) => item.product_id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(QUOTE_PRODUCT_SELECT)
    .in('id', productIds)

  if (productsError) throw schemaErrorOrOriginal(productsError)

  const snapshots = buildQuoteSnapshotItems({ items: input.items, products, locale: input.locale })
  const metadata = sourceMetadata(input, request)
  const consentAt = new Date().toISOString()
  const { data: quote, error: quoteError } = await supabase
    .from('quote_requests')
    .insert({
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_email: input.customer_email,
      organization: input.organization,
      bin: input.bin,
      city: input.city,
      customer_message: input.customer_message,
      locale: input.locale,
      consent_personal_data: input.consent_personal_data,
      consent_at: consentAt,
      idempotency_key: input.idempotency_key,
      ...metadata,
      status: 'new',
    })
    .select('id,status')
    .single()

  if (quoteError) {
    if (quoteError.code === '23505') {
      const duplicate = await loadExistingByIdempotency(supabase, input.idempotency_key)
      if (duplicate) return { id: duplicate.id, status: duplicate.status, replayed: true }
    }
    throw schemaErrorOrOriginal(quoteError)
  }

  const { error: itemsError } = await supabase
    .from('quote_request_items')
    .insert(snapshots.map((item) => ({ ...item, quote_request_id: quote.id })))

  if (itemsError) {
    safeDatabaseLog('POST items', itemsError)
    await supabase.from('quote_requests').delete().eq('id', quote.id)
    throw schemaErrorOrOriginal(itemsError)
  }

  return { id: quote.id, status: quote.status, replayed: false }
}

function pruneIdempotency() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS
  for (const [key, value] of quoteIdempotency.entries()) {
    if (value.createdAt < cutoff) quoteIdempotency.delete(key)
  }
}

export async function POST(request) {
  const rateLimit = checkRateLimit(request, { limit: 5, windowMs: 60_000, scope: 'quote-requests' })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  try {
    const input = validateQuoteRequestPayload(await readJsonBody(request, 32 * 1024))
    const headerKey = request.headers.get('idempotency-key')
    if (headerKey && headerKey !== input.idempotency_key) {
      throw new RequestValidationError('Idempotency-Key does not match the request body')
    }

    pruneIdempotency()
    const cached = quoteIdempotency.get(input.idempotency_key)
    if (cached) {
      const result = cached.promise ? await cached.promise : cached.result
      return NextResponse.json({ ...result, replayed: true }, { status: 200 })
    }

    const promise = createQuoteRequest(input, request)
    quoteIdempotency.set(input.idempotency_key, { createdAt: Date.now(), promise })
    try {
      const result = await promise
      quoteIdempotency.set(input.idempotency_key, { createdAt: Date.now(), result })
      return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      quoteIdempotency.delete(input.idempotency_key)
      throw error
    }
  } catch (error) {
    if (error instanceof RequestValidationError || error instanceof QuoteProductUnavailableError) return validationResponse(error)
    if (error instanceof QuoteSchemaNotReadyError) {
      safeDatabaseLog('POST schema', error)
      return NextResponse.json({ error: 'Quote requests are temporarily unavailable' }, { status: 503 })
    }
    safeDatabaseLog('POST', error)
    return NextResponse.json({ error: 'Unable to create quote request' }, { status: 500 })
  }
}

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const format = url.searchParams.get('format')
    const rawLimit = Number(url.searchParams.get('limit') || 100)
    const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 && rawLimit <= MAX_ADMIN_LIMIT ? rawLimit : 100
    if (status && !['new', 'contacted', 'in_progress', 'closed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    let query = auth.supabase
      .from('quote_requests')
      .select(QUOTE_REQUEST_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw schemaErrorOrOriginal(error)

    if (format === 'csv') {
      return new NextResponse(buildQuoteCsv(data || []), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nurset-quote-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json(data || [], { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof QuoteSchemaNotReadyError) return NextResponse.json({ error: 'Quote request storage is not ready' }, { status: 503 })
    safeDatabaseLog('GET', error)
    return NextResponse.json({ error: 'Unable to load quote requests' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const input = validateQuoteAdminUpdate(await readJsonBody(request, 16 * 1024))
    const update = { updated_at: new Date().toISOString() }
    if (input.status !== undefined) update.status = input.status
    if (input.internal_comment !== undefined) update.internal_comment = input.internal_comment
    const { data, error } = await auth.supabase
      .from('quote_requests')
      .update(update)
      .eq('id', input.id)
      .select('id,status,internal_comment,updated_at')
      .maybeSingle()
    if (error) throw schemaErrorOrOriginal(error)
    if (!data) return NextResponse.json({ error: 'Quote request not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof RequestValidationError) return validationResponse(error)
    if (error instanceof QuoteSchemaNotReadyError) return NextResponse.json({ error: 'Quote request storage is not ready' }, { status: 503 })
    safeDatabaseLog('PATCH', error)
    return NextResponse.json({ error: 'Unable to update quote request' }, { status: 500 })
  }
}
