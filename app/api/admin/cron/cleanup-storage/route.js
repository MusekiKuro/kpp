import { NextResponse } from 'next/server'
import { processStorageCleanupBatch } from '@/lib/storage-cleanup-processor.mjs'
import { runCleanupHandler } from '@/lib/cleanup-cron-handler.mjs'

/**
 * Next.js route handler – public contract entry point.
 * Delegates to runCleanupHandler with production dependencies.
 */
export async function POST(request) {
  return runCleanupHandler(request, {
    processor: processStorageCleanupBatch,
    env: process.env,
    makeJsonResponse: NextResponse.json.bind(NextResponse),
  })
}
