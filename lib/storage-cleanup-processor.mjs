import { createServiceRoleClient } from './supabase-server.js'

const MAX_BATCH_SIZE = 100
const MAX_ATTEMPTS = 5
const LEASE_SECONDS = 600

export class StorageCleanupProcessorError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StorageCleanupProcessorError'
  }
}

function batchLimit(value) {
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, MAX_BATCH_SIZE)
    : 50
}

export function isSafeCleanupTarget(bucket, storagePath) {
  return bucket === 'product-images'
    && typeof storagePath === 'string'
    && storagePath.length > 0
    && storagePath.length <= 1024
    && !storagePath.startsWith('/')
    && !storagePath.includes('..')
    && !storagePath.includes('\\')
}

function retryAt(attempts) {
  const delayMinutes = Math.min(24 * 60, 5 * (2 ** Math.max(0, attempts - 1)))
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
}

async function updateClaimedJob(client, job, payload) {
  const { data, error } = await client
    .from('storage_cleanup_queue')
    .update({
      ...payload,
      lease_token: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('lease_token', job.lease_token)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()

  if (error) {
    throw new StorageCleanupProcessorError(`Unable to update cleanup job ${job.id}: ${error.message}`)
  }
  if (!data) {
    throw new StorageCleanupProcessorError(`Cleanup job ${job.id} lease is no longer owned by this worker`)
  }
}

async function markFailed(client, job, error) {
  const attempts = Number.isSafeInteger(job.attempts) ? job.attempts + 1 : 1
  await updateClaimedJob(client, job, {
    attempts,
    last_error: String(error?.message || 'Storage cleanup failed').slice(0, 2000),
    next_attempt_at: retryAt(attempts),
    status: 'failed',
    completed_at: null,
  })
}

async function markCompleted(client, job) {
  await updateClaimedJob(client, job, {
    status: 'completed',
    last_error: null,
    completed_at: new Date().toISOString(),
  })
}

export async function processStorageCleanupBatch({ limit = 50, supabase = null } = {}) {
  const client = supabase || createServiceRoleClient()
  const { data: jobs, error: claimError } = await client.rpc('claim_storage_cleanup_jobs', {
    p_limit: batchLimit(limit),
    p_lease_seconds: LEASE_SECONDS,
  })

  if (claimError) {
    throw new StorageCleanupProcessorError(`Unable to claim cleanup jobs: ${claimError.message}`)
  }

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const job of jobs) {
    try {
      if (!job?.id || !job?.lease_token || !isSafeCleanupTarget(job.bucket, job.storage_path)) {
        throw new Error('Unsafe or incomplete Storage cleanup target')
      }

      const { error: removeError } = await client.storage.from(job.bucket).remove([job.storage_path])
      if (removeError) throw new Error(removeError.message || 'Storage removal failed')

      await markCompleted(client, job)
      succeeded++
    } catch (error) {
      if (error instanceof StorageCleanupProcessorError) throw error
      await markFailed(client, job, error)
      failed++
    }
  }

  return { processed: jobs.length, succeeded, failed }
}
