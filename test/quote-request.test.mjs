import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateQuoteRequestPayload, RequestValidationError } from '../lib/request-validation.js'
import { buildQuoteSnapshotItems, buildQuoteCsv } from '../lib/quote-requests.mjs'

const productId = '11111111-1111-4111-8111-111111111111'
const secondProductId = '22222222-2222-4222-8222-222222222222'

function validPayload(overrides = {}) {
  return {
    customer_name: 'Тестовая компания',
    customer_phone: '+7 (700) 123-45-67',
    customer_email: 'buyer@example.com',
    organization: 'ТОО Тест',
    bin: '123456789012',
    city: 'Алматы',
    customer_message: 'Нужна консультация',
    locale: 'ru',
    consent_personal_data: true,
    idempotency_key: 'test-key-123456789',
    items: [{ product_id: productId, quantity: 2 }],
    source_url: 'https://example.com/ru/request',
    utm_source: 'catalog',
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    ...overrides,
  }
}

test('quote validation accepts the minimal strict payload and normalizes optionals', () => {
  const result = validateQuoteRequestPayload(validPayload({ organization: undefined, customer_email: undefined }))
  assert.equal(result.organization, null)
  assert.equal(result.customer_email, null)
  assert.deepEqual(result.items, [{ product_id: productId, quantity: 2 }])
})

test('quote validation rejects client product snapshots and duplicate ids', () => {
  assert.throws(() => validateQuoteRequestPayload(validPayload({ items: [{ product_id: productId, quantity: 1, name: 'Tampered' }] })), RequestValidationError)
  assert.throws(() => validateQuoteRequestPayload(validPayload({ items: [{ product_id: productId, quantity: 1 }, { product_id: productId, quantity: 2 }] })), /duplicate/i)
})

test('quote validation rejects missing consent and malformed contact fields', () => {
  assert.throws(() => validateQuoteRequestPayload(validPayload({ consent_personal_data: false })), /consent/i)
  assert.throws(() => validateQuoteRequestPayload(validPayload({ customer_email: 'not-an-email' })), /email/i)
  assert.throws(() => validateQuoteRequestPayload(validPayload({ bin: '123' })), /bin/i)
})

test('snapshot enrichment ignores client fields and requires published locale data', () => {
  const snapshots = buildQuoteSnapshotItems({
    locale: 'ru',
    items: [{ product_id: productId, quantity: 2 }],
    products: [{
      id: productId,
      sku: 'SKU-1',
      name_ru: 'Server name',
      name_kk: 'Сервер атауы',
      image_url: 'https://cdn.example.com/1.jpg',
      price_mode: 'from',
      price_amount: 1250,
      currency: 'KZT',
      publication_status: 'published',
      publish_ru: true,
      publish_kk: true,
      translation_status_kk: 'verified',
      client_name: 'Tampered name',
      client_price: 1,
    }],
  })
  assert.deepEqual(snapshots[0], {
    product_id: productId,
    quantity: 2,
    sku_snapshot: 'SKU-1',
    name_snapshot: 'Server name',
    image_url_snapshot: 'https://cdn.example.com/1.jpg',
    price_mode_snapshot: 'from',
    price_amount_snapshot: 1250,
    currency_snapshot: 'KZT',
    sort_order: 0,
  })
  assert.throws(() => buildQuoteSnapshotItems({
    locale: 'kk',
    items: [{ product_id: secondProductId, quantity: 1 }],
    products: [{ id: secondProductId, name_kk: 'Unverified', publication_status: 'published', publish_kk: true, translation_status_kk: 'draft', currency: 'KZT' }],
  }), /unavailable/i)
})

test('quote preview resolves private products through the server-only client', async () => {
  const route = await readFile(new URL('../app/api/quote-requests/preview/route.js', import.meta.url), 'utf8')
  assert.match(route, /createServiceRoleClient/)
  assert.doesNotMatch(route, /createServerClient/)
  assert.match(route, /\.eq\('publication_status', 'published'\)/)
  assert.match(route, /\.eq\(publishField, true\)/)
})

test('quote CSV prefixes formula-like cells', () => {
  const csv = buildQuoteCsv([{ id: 'q1', customer_name: '=HYPERLINK("bad")', customer_phone: '+77001234567', status: 'new', locale: 'ru', items: [{ name_snapshot: '@item', quantity: 1 }] }])
  assert.match(csv, /'=HYPERLINK/)
  assert.match(csv, /'@item/)
})

test('T02 and T07 migrations keep quote data private and idempotency durable', async () => {
  const t02 = await readFile(new URL('../supabase/migrations/20260722010000_add_catalog_domain.sql', import.meta.url), 'utf8')
  const t07 = await readFile(new URL('../supabase/migrations/20260723000000_add_quote_idempotency_consent.sql', import.meta.url), 'utf8')
  assert.match(t02, /ALTER TABLE public\.quote_requests ENABLE ROW LEVEL SECURITY/)
  assert.match(t02, /Admins read quote requests/)
  assert.doesNotMatch(t02, /quote_requests_public_(select|insert)/)
  assert.match(t07, /consent_at/)
  assert.match(t07, /CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_idempotency_key_unique_idx/)
})

test('F03 migration revokes public orders INSERT policy while retaining admin policies', async () => {
  const f03 = await readFile(new URL('../supabase/migrations/20260724010000_disable_public_orders_insert.sql', import.meta.url), 'utf8')
  assert.match(f03, /DROP POLICY IF EXISTS "Public insert orders" ON public\.orders/)
  assert.match(f03, /ALTER TABLE public\.orders ENABLE ROW LEVEL SECURITY/)
  assert.match(f03, /CREATE POLICY "Admins read orders"/)
  assert.match(f03, /CREATE POLICY "Admins update orders"/)
  assert.match(f03, /CREATE POLICY "Admins delete orders"/)
  assert.doesNotMatch(f03, /CREATE POLICY "Public insert orders"/)
})
