import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { publicStoragePath } from '../lib/admin-catalog.mjs'
import {
  isSafeCleanupTarget,
  processStorageCleanupBatch,
  StorageCleanupProcessorError,
} from '../lib/storage-cleanup-processor.mjs'

function cleanupClient({ jobs = [], claimError = null, removeError = null, updateResult = { id: 'job-1' } } = {}) {
  const calls = { rpc: [], removed: [], updates: [] }
  const client = {
    rpc: async (name, args) => {
      calls.rpc.push({ name, args })
      return { data: jobs, error: claimError }
    },
    from: (table) => {
      assert.equal(table, 'storage_cleanup_queue')
      return {
        update: (payload) => {
          const filters = []
          const chain = {
            eq: (field, value) => {
              filters.push([field, value])
              return chain
            },
            select: () => chain,
            maybeSingle: async () => {
              calls.updates.push({ payload, filters })
              return { data: updateResult, error: null }
            },
          }
          return chain
        },
      }
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          calls.removed.push({ bucket, paths })
          return { error: removeError }
        },
      }),
    },
  }
  return { client, calls }
}

test('gallery remediation migration uses two-step primary switch and lease-based queue claiming', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260724040000_complete_catalog_runtime_contracts.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_published_product_ids_by_attributes/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_storage_cleanup_jobs/)
  assert.match(sql, /FOR UPDATE SKIP LOCKED/)
  assert.match(sql, /status = 'processing'/)
  assert.match(sql, /lease_token = v_lease_token/)

  const primaryFunction = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.set_primary_product_image'))
  const clearIndex = primaryFunction.indexOf('SET is_primary = false')
  const setIndex = primaryFunction.indexOf('SET is_primary = true')
  assert.ok(clearIndex >= 0 && setIndex > clearIndex)
})

test('gallery create route passes is_primary into the atomic create RPC', async () => {
  const route = await readFile(new URL('../app/api/admin/catalog/products/[id]/gallery/route.js', import.meta.url), 'utf8')
  assert.match(route, /is_primary:\s*body\.is_primary\s*===\s*true/)
  const postBody = route.slice(route.indexOf('export async function POST'))
  assert.doesNotMatch(postBody, /rpc\('set_primary_product_image'/)
})

test('storage path validation rejects traversal, absolute paths, and foreign buckets', () => {
  assert.equal(publicStoragePath('https://example.com/storage/v1/object/public/product-images/laptops/image.jpg'), 'laptops/image.jpg')
  assert.equal(publicStoragePath('https://example.com/storage/v1/object/public/product-images/../etc/passwd'), null)
  assert.equal(publicStoragePath('https://example.com/storage/v1/object/public/product-images//etc/passwd'), null)
  assert.equal(isSafeCleanupTarget('product-images', 'laptops/image.jpg'), true)
  assert.equal(isSafeCleanupTarget('other-bucket', 'laptops/image.jpg'), false)
  assert.equal(isSafeCleanupTarget('product-images', '../secret'), false)
  assert.equal(isSafeCleanupTarget('product-images', '\\secret'), false)
})

test('cleanup processor claims a lease and conditionally completes the owned job', async () => {
  const job = { id: 'job-1', bucket: 'product-images', storage_path: 'laptops/1.jpg', attempts: 0, lease_token: 'lease-1' }
  const { client, calls } = cleanupClient({ jobs: [job] })

  const result = await processStorageCleanupBatch({ limit: 10, supabase: client })
  assert.deepEqual(result, { processed: 1, succeeded: 1, failed: 0 })
  assert.deepEqual(calls.rpc, [{ name: 'claim_storage_cleanup_jobs', args: { p_limit: 10, p_lease_seconds: 600 } }])
  assert.deepEqual(calls.removed, [{ bucket: 'product-images', paths: ['laptops/1.jpg'] }])
  assert.equal(calls.updates[0].payload.status, 'completed')
  assert.equal(calls.updates[0].payload.lease_token, null)
  assert.deepEqual(calls.updates[0].filters, [
    ['id', 'job-1'],
    ['lease_token', 'lease-1'],
    ['status', 'processing'],
  ])
})

test('cleanup processor records a retryable failure under the same lease', async () => {
  const job = { id: 'job-1', bucket: 'product-images', storage_path: 'laptops/2.jpg', attempts: 1, lease_token: 'lease-2' }
  const { client, calls } = cleanupClient({ jobs: [job], removeError: { message: 'Storage unavailable' } })

  const result = await processStorageCleanupBatch({ supabase: client })
  assert.deepEqual(result, { processed: 1, succeeded: 0, failed: 1 })
  assert.equal(calls.updates[0].payload.status, 'failed')
  assert.equal(calls.updates[0].payload.attempts, 2)
  assert.equal(calls.updates[0].payload.last_error, 'Storage unavailable')
  assert.equal(calls.updates[0].payload.lease_token, null)
})

test('cleanup processor fails loudly when claim or lease finalization fails', async () => {
  const claimFailure = cleanupClient({ claimError: { message: 'database unavailable' } })
  await assert.rejects(
    () => processStorageCleanupBatch({ supabase: claimFailure.client }),
    StorageCleanupProcessorError,
  )

  const lostLease = cleanupClient({
    jobs: [{ id: 'job-1', bucket: 'product-images', storage_path: 'laptops/3.jpg', attempts: 0, lease_token: 'expired' }],
    updateResult: null,
  })
  await assert.rejects(
    () => processStorageCleanupBatch({ supabase: lostLease.client }),
    /lease is no longer owned/,
  )
})

test('cleanup-storage cron entrypoint enforces CRON_SECRET and constant-time authentication', async () => {
  // The route.js is now a thin wrapper; the auth logic lives in cleanup-cron-handler.mjs
  const route = await readFile(new URL('../app/api/admin/cron/cleanup-storage/route.js', import.meta.url), 'utf8')
  const handler = await readFile(new URL('../lib/cleanup-cron-handler.mjs', import.meta.url), 'utf8')

  // Route must delegate to the handler module
  assert.match(route, /runCleanupHandler/)

  // Handler module must contain the auth enforcement
  assert.match(handler, /process\.env\.CRON_SECRET|env\.CRON_SECRET/)
  assert.match(handler, /timingSafeEqual/)
  assert.match(handler, /x-cron-secret/)
  assert.match(handler, /status:\s*401/)
  assert.match(handler, /status:\s*500/)

  // Neither file must reference public env vars for secrets
  assert.doesNotMatch(route, /NEXT_PUBLIC/)
  assert.doesNotMatch(handler, /NEXT_PUBLIC/)
})
