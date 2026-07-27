import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { IMPORT_LIMITS, ImportInputError } from '@/lib/import-staging.mjs'
import { importErrorResponse } from '@/lib/import-api.mjs'
import { inspectXlsx } from '@/lib/import-xlsx.mjs'

const MAX_MULTIPART_OVERHEAD = 128 * 1024

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      throw new ImportInputError('XLSX preview must use multipart/form-data')
    }

    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > IMPORT_LIMITS.maxSourceBytes + MAX_MULTIPART_OVERHEAD) {
      throw new ImportInputError(`XLSX file exceeds ${IMPORT_LIMITS.maxSourceBytes} bytes`, 413)
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new ImportInputError('file is required')
    }

    if (file.size > IMPORT_LIMITS.maxSourceBytes) {
      throw new ImportInputError(`XLSX file exceeds ${IMPORT_LIMITS.maxSourceBytes} bytes`, 413)
    }

    const sheetName = form.get('sheet') ? String(form.get('sheet')).trim() : undefined
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await inspectXlsx(buffer, { sheetName })

    return NextResponse.json(result)
  } catch (error) {
    return importErrorResponse(error, 'xlsx preview')
  }
}
