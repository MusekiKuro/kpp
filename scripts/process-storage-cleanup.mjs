import { processStorageCleanupBatch } from '../lib/storage-cleanup-processor.mjs'

async function run() {
  console.log('Starting storage cleanup batch processor...')
  const result = await processStorageCleanupBatch({ limit: 50 })
  console.log('Storage cleanup batch processor result:', result)
  if (result.failed > 0) process.exitCode = 1
}

run().catch((err) => {
  console.error('Storage cleanup processor script crashed:', err)
  process.exit(1)
})
