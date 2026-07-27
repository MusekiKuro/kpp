import { timingSafeEqual } from 'node:crypto'

/**
 * Timing-safe string comparison.
 * Returns false if either value is empty.
 * Uses constant-length comparison: returns false (not timing-safe) for different lengths,
 * which is safe because we don't leak a timing signal about where strings diverge –
 * only whether they are the same length and equal.
 */
export function safeCompare(provided, expected) {
  if (!provided || !expected) return false
  const bufA = Buffer.from(String(provided))
  const bufB = Buffer.from(String(expected))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Extracts the presented secret from the request.
 * Prefers the x-cron-secret header; falls back to Authorization: Bearer <token>.
 */
export function extractSecret(request) {
  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader) return cronHeader

  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return ''
}

/**
 * Core handler logic for the cleanup-storage cron route.
 *
 * @param {Request} request - The incoming request object.
 * @param {object} deps - Injected dependencies for testability.
 * @param {Function} deps.processor - The cleanup batch processor (default: real processStorageCleanupBatch).
 * @param {object} deps.env - Environment variables (default: process.env).
 * @param {Function} deps.makeJsonResponse - Factory for JSON responses (default: NextResponse.json).
 * @returns {Promise<Response>} - The HTTP response.
 */
export async function runCleanupHandler(request, { processor, env = process.env, makeJsonResponse }) {
  const expectedSecret = env.CRON_SECRET
  if (!expectedSecret) {
    return makeJsonResponse(
      { error: 'Cron secret is not configured on the server' },
      { status: 500 },
    )
  }

  const providedSecret = extractSecret(request)
  if (!safeCompare(providedSecret, expectedSecret)) {
    return makeJsonResponse(
      { error: 'Unauthorized cron invocation' },
      { status: 401 },
    )
  }

  try {
    const result = await processor({ limit: 50 })
    return makeJsonResponse({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    })
  } catch (error) {
    // Log server-side (safe: no tokens, keys, URLs with secrets, or PII).
    // Do NOT include error.message in the client response.
    console.error('Storage cleanup processor failed', { name: error?.name, code: error?.code })
    return makeJsonResponse(
      { error: 'Storage cleanup processor failed' },
      { status: 500 },
    )
  }
}
