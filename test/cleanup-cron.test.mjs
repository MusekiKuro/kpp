/**
 * Route-level tests for the cleanup-storage cron handler.
 *
 * These tests call runCleanupHandler directly with injected dependencies,
 * so they never touch real Supabase, storage, or the Next.js runtime.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runCleanupHandler } from '../lib/cleanup-cron-handler.mjs'

// ---------------------------------------------------------------------------
// Minimal mock request factory
// ---------------------------------------------------------------------------

function makeRequest({ authorization, xCronSecret } = {}) {
  const headers = new Map()
  if (authorization !== undefined) headers.set('authorization', authorization)
  if (xCronSecret !== undefined) headers.set('x-cron-secret', xCronSecret)
  return {
    headers: {
      get: (name) => headers.get(name.toLowerCase()) ?? null,
    },
  }
}

// Minimal mock JSON response factory (replaces NextResponse.json in tests)
function makeJsonResponse(body, init = {}) {
  const status = init?.status ?? 200
  return {
    status,
    async json() { return body },
  }
}

const MOCK_SECRET = 'test-cron-secret-value-xyz'

// Mock processor that succeeds
const successProcessor = async () => ({ processed: 3, succeeded: 3, failed: 0 })

// Mock processor that throws
const failingProcessor = async () => { throw new Error('Database connection failed') }

// ---------------------------------------------------------------------------
// T1: CRON_SECRET not configured → 500
// ---------------------------------------------------------------------------

test('returns 500 when CRON_SECRET is not configured', async () => {
  const request = makeRequest({ authorization: `Bearer ${MOCK_SECRET}` })
  const response = await runCleanupHandler(request, {
    processor: successProcessor,
    env: {}, // No CRON_SECRET
    makeJsonResponse,
  })

  assert.equal(response.status, 500)
  const body = await response.json()
  assert.match(body.error, /not configured/i)
  // Must not contain the actual secret value in response
  assert.ok(!JSON.stringify(body).includes(MOCK_SECRET))
})

// ---------------------------------------------------------------------------
// T2: Authorization header absent → 401
// ---------------------------------------------------------------------------

test('returns 401 when no authorization header is provided', async () => {
  const request = makeRequest() // No auth header
  const response = await runCleanupHandler(request, {
    processor: successProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })

  assert.equal(response.status, 401)
  const body = await response.json()
  assert.match(body.error, /unauthorized/i)
})

// ---------------------------------------------------------------------------
// T3: Wrong bearer token → 401
// ---------------------------------------------------------------------------

test('returns 401 when bearer token is wrong', async () => {
  const request = makeRequest({ authorization: 'Bearer wrong-token-value' })
  const response = await runCleanupHandler(request, {
    processor: successProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })

  assert.equal(response.status, 401)
  const body = await response.json()
  assert.match(body.error, /unauthorized/i)
})

// ---------------------------------------------------------------------------
// T4: Correct bearer token → processor called exactly once, returns 200
// ---------------------------------------------------------------------------

test('returns 200 with correct counts when bearer token is correct', async () => {
  let callCount = 0
  const countingProcessor = async () => {
    callCount++
    return { processed: 5, succeeded: 4, failed: 1 }
  }

  const request = makeRequest({ authorization: `Bearer ${MOCK_SECRET}` })
  const response = await runCleanupHandler(request, {
    processor: countingProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })

  assert.equal(response.status, 200)
  assert.equal(callCount, 1, 'processor must be called exactly once')

  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.processed, 5)
  assert.equal(body.succeeded, 4)
  assert.equal(body.failed, 1)
})

// ---------------------------------------------------------------------------
// T4b: x-cron-secret header also accepted
// ---------------------------------------------------------------------------

test('returns 200 when secret is provided via x-cron-secret header', async () => {
  const request = makeRequest({ xCronSecret: MOCK_SECRET })
  const response = await runCleanupHandler(request, {
    processor: successProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
})

// ---------------------------------------------------------------------------
// T5: Processor throws → 500 generic error (no internal message in response)
// ---------------------------------------------------------------------------

test('returns 500 when processor throws without leaking error.message to client', async () => {
  const request = makeRequest({ authorization: `Bearer ${MOCK_SECRET}` })
  const response = await runCleanupHandler(request, {
    processor: failingProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })

  assert.equal(response.status, 500)
  const body = await response.json()
  assert.ok(typeof body.error === 'string', 'Response must have a generic error message')
  // Must NOT expose 'Database connection failed' or any internal error detail
  assert.ok(
    !body.error.includes('Database connection failed'),
    'Internal error message must not be included in client response',
  )
  // Must NOT have a details field
  assert.ok(
    !('details' in body),
    'Response must not include a details field with internal error content',
  )
})

// ---------------------------------------------------------------------------
// T6: Secret does not appear in any response body
// ---------------------------------------------------------------------------

test('correct secret value never appears in any response body', async () => {
  // Test with 401 (wrong token)
  const wrongRequest = makeRequest({ authorization: 'Bearer wrong' })
  const wrongResponse = await runCleanupHandler(wrongRequest, {
    processor: successProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })
  const wrongBody = JSON.stringify(await wrongResponse.json())
  assert.ok(!wrongBody.includes(MOCK_SECRET), 'Correct secret must not appear in 401 response body')

  // Test with 500 (processor error)
  const errorRequest = makeRequest({ authorization: `Bearer ${MOCK_SECRET}` })
  const errorResponse = await runCleanupHandler(errorRequest, {
    processor: failingProcessor,
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })
  const errorBody = JSON.stringify(await errorResponse.json())
  assert.ok(!errorBody.includes(MOCK_SECRET), 'Correct secret must not appear in 500 response body')
})

// ---------------------------------------------------------------------------
// T7: Timing-safe comparison handles different-length strings correctly
// (no crash on mismatched lengths)
// ---------------------------------------------------------------------------

test('comparison handles secrets of very different lengths without throwing', async () => {
  // Very short provided vs long expected
  const shortRequest = makeRequest({ authorization: 'Bearer x' })
  const response1 = await runCleanupHandler(shortRequest, {
    processor: successProcessor,
    env: { CRON_SECRET: 'a'.repeat(200) },
    makeJsonResponse,
  })
  assert.equal(response1.status, 401)

  // Very long provided vs short expected
  const longRequest = makeRequest({ authorization: `Bearer ${'x'.repeat(500)}` })
  const response2 = await runCleanupHandler(longRequest, {
    processor: successProcessor,
    env: { CRON_SECRET: 'short' },
    makeJsonResponse,
  })
  assert.equal(response2.status, 401)
})

// ---------------------------------------------------------------------------
// T8: Correct secret with zero-work processor (fully isolated from Supabase)
// ---------------------------------------------------------------------------

test('handler works correctly with zero-work processor (Supabase not accessed)', async () => {
  const request = makeRequest({ authorization: `Bearer ${MOCK_SECRET}` })
  const response = await runCleanupHandler(request, {
    processor: async () => ({ processed: 0, succeeded: 0, failed: 0 }),
    env: { CRON_SECRET: MOCK_SECRET },
    makeJsonResponse,
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.processed, 0)
  assert.equal(body.succeeded, 0)
  assert.equal(body.failed, 0)
  assert.equal(body.success, true)
})
