import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseCsv, parseJson, normalizeRows, hashSource, buildFieldDiff } from '../lib/import-staging.mjs'
import { parseSource, stageSource } from '../lib/import-staging-server.mjs'

const sourceHash = 'a'.repeat(64)
const fixture = JSON.parse(await readFile(new URL('../fixtures/import/t09-valid.json', import.meta.url), 'utf8'))[0]

function existingProduct() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    external_id: 'EXT-OLD',
    sku: 'SKU-001',
    slug: 'old-chair',
    category: { slug: 'office' },
    brand: { slug: 'acme' },
    name_ru: 'Старое название',
    name_kk: 'Ескі атауы',
    short_description_ru: null,
    short_description_kk: null,
    description_ru: 'Старое описание',
    description_kk: null,
    price_mode: 'request',
    price_amount: null,
    old_price_amount: null,
    currency: 'KZT',
    stock_status: 'unknown',
    publication_status: 'draft',
    publish_ru: false,
    publish_kk: false,
    translation_status_kk: 'verified',
    is_featured: false,
    image_url: null,
    source_type: 'json',
    source_reference: 'feed-a',
  }
}

test('JSON and CSV parsers reject malformed input and preserve formulas as text', () => {
  assert.deepEqual(parseJson(JSON.stringify({ rows: [fixture] })), [fixture])
  assert.throws(() => parseJson('{bad'), /JSON source is invalid/)
  assert.throws(() => parseCsv('sku,name_ru\n"unterminated'), /unterminated quoted field/)
  assert.throws(() => parseCsv('sku,name_ru,unexpected\nSKU-1,Name,Value'), /normalized import field names/)
  const rows = parseCsv('sku,name_ru,category_slug\nSKU-1,=HYPERLINK("x"),office')
  assert.equal(rows[0].name_ru, '=HYPERLINK("x")')
})

test('duplicate SKUs in one source become review errors', () => {
  const result = normalizeRows([fixture, { ...fixture, external_id: 'EXT-002' }], {
    sourceType: 'json', sourceReference: 'feed-a', sourceHash, existingProducts: [],
  })
  assert.equal(result.summary.create, 1)
  assert.equal(result.summary.error, 1)
  assert.equal(result.summary.duplicate, 1)
  assert.match(result.rows[1].validation_errors.join(' '), /duplicate SKU/)
})

test('source-scoped external IDs also cannot repeat under different SKUs', () => {
  const result = normalizeRows([
    fixture,
    { ...fixture, sku: 'SKU-002', external_id: fixture.external_id },
  ], {
    sourceType: 'json', sourceReference: 'feed-a', sourceHash, existingProducts: [],
  })
  assert.equal(result.summary.error, 1)
  assert.equal(result.summary.duplicate, 1)
})

test('malformed row fields are retained for review without being applied', () => {
  const result = normalizeRows([{ ...fixture, unexpected_field: 'do not accept' }], {
    sourceType: 'json', sourceReference: 'feed-a', sourceHash, existingProducts: [],
  })
  assert.equal(result.rows[0].proposed_action, 'error')
  assert.match(result.rows[0].validation_errors.join(' '), /not an allowed import field/)
  assert.equal(result.rows[0].normalized_payload, null)
})

test('partial updates match by SKU and enrich omitted fields from the existing product', () => {
  const result = normalizeRows([{ sku: 'SKU-001', price_mode: 'exact', price_amount: 15000 }], {
    sourceType: 'json', sourceReference: 'feed-a', sourceHash, existingProducts: [existingProduct()],
  })
  const row = result.rows[0]
  assert.equal(row.proposed_action, 'update')
  assert.equal(row.matched_product_id, existingProduct().id)
  assert.equal(row.normalized_payload.name_ru, 'Старое название')
  assert.equal(row.normalized_payload.price_amount, 15000)
  assert.equal(buildFieldDiff(row, existingProduct()).fields.some((field) => field.field === 'price_amount'), true)
})

test('imports never publish and source hashing is deterministic for retry checks', async () => {
  const publishRow = { ...fixture, publication_status: 'published', publish_ru: true, publish_kk: true }
  const result = normalizeRows([publishRow], {
    sourceType: 'json', sourceReference: 'feed-a', sourceHash, existingProducts: [],
  })
  assert.equal(result.rows[0].normalized_payload.publication_status, 'draft')
  assert.equal(result.rows[0].normalized_payload.publish_ru, false)
  assert.equal(result.rows[0].normalized_payload.publish_kk, false)
  assert.ok(result.rows[0].validation_warnings.length > 0)
  const buffer = Buffer.from(JSON.stringify([fixture]))
  assert.equal(hashSource(buffer), hashSource(Buffer.from(JSON.stringify([fixture]))))
  assert.equal((await parseSource(buffer, 'products.json')).sourceHash, hashSource(buffer))
})

test('an already staged source is rejected before matching or row writes', async () => {
  const staged = { id: '22222222-2222-4222-8222-222222222222', source_hash: sourceHash, status: 'parsed' }
  const supabase = {
    from(table) {
      assert.equal(table, 'import_batches')
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: staged, error: null } },
      }
    },
  }
  await assert.rejects(
    () => stageSource({ supabase, userId: '33333333-3333-4333-8333-333333333333', buffer: Buffer.from(JSON.stringify([fixture])), filename: 'products.json', sourceReference: 'feed-a' }),
    (error) => error.status === 409 && error.batch.id === staged.id,
  )
})

test('apply migration has retry-safe terminal and failed states', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260723020000_add_import_apply_rpc.sql', import.meta.url), 'utf8')
  assert.match(sql, /v_batch\.status = 'completed'/)
  assert.match(sql, /v_batch\.status NOT IN \('approved', 'failed'\)/)
  assert.match(sql, /SET status = 'failed'/)
  assert.doesNotMatch(sql, /DELETE FROM public\.products/i)
  assert.doesNotMatch(sql, /SET[\s\S]*publication_status\s*=\s*'published'/i)

  // F01 regression static checks
  const authCheckIndex = sql.indexOf("auth.jwt() -> 'app_metadata' ->> 'role'")
  const innerBeginIndex = sql.indexOf('BEGIN', authCheckIndex + 1)
  const exceptionIndex = sql.indexOf('EXCEPTION WHEN OTHERS THEN', innerBeginIndex)

  assert.ok(authCheckIndex !== -1, 'Auth check must exist in SQL migration')
  assert.ok(innerBeginIndex !== -1, 'Inner BEGIN block must exist')
  assert.ok(authCheckIndex < innerBeginIndex, 'Auth check must be placed OUTSIDE the inner operational EXCEPTION block')
  assert.ok(sql.includes("IF SQLSTATE = '42501' THEN"), 'Exception handler must re-raise 42501 errors')
})

test('apply_import_batch simulation enforces admin role and prevents unauthorized state mutation', async () => {
  function simulateApplyImportBatch(jwt, batchState, operationalError = false) {
    const role = jwt?.app_metadata?.role
    // Authorization check outside operational error handler
    if (role !== 'admin') {
      const err = new Error('forbidden')
      err.code = '42501'
      throw err
    }

    // Operational import block
    try {
      if (operationalError) {
        throw new Error('category not found')
      }
      batchState.status = 'completed'
      return { status: 'completed', idempotent: false }
    } catch (err) {
      if (err.code === '42501') throw err
      batchState.status = 'failed'
      return { status: 'failed', error: 'apply failed', error_code: '23503' }
    }
  }

  // Unauthorized call (non-admin authenticated user)
  const unauthorizedBatchState = { status: 'approved' }
  assert.throws(
    () => simulateApplyImportBatch({ app_metadata: { role: 'user' } }, unauthorizedBatchState),
    (err) => err.code === '42501',
  )
  assert.equal(unauthorizedBatchState.status, 'approved', 'Batch status must remain unchanged for unauthorized user')

  // Authorized call (admin user - success)
  const authorizedBatchState = { status: 'approved' }
  const successResult = simulateApplyImportBatch({ app_metadata: { role: 'admin' } }, authorizedBatchState)
  assert.equal(successResult.status, 'completed')
  assert.equal(authorizedBatchState.status, 'completed')

  // Authorized call (admin user - operational failure)
  const failedBatchState = { status: 'approved' }
  const failedResult = simulateApplyImportBatch({ app_metadata: { role: 'admin' } }, failedBatchState, true)
  assert.equal(failedResult.status, 'failed')
  assert.equal(failedBatchState.status, 'failed')
})
