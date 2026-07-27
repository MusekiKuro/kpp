import { NextResponse } from 'next/server.js'
import { ImportInputError } from './import-staging.mjs'
import { RequestValidationError, isUUID, readJsonBody } from './request-validation.js'

const IMPORT_STATUSES = new Set(['uploaded', 'parsed', 'needs_review', 'approved', 'applying', 'completed', 'failed', 'cancelled'])

export function importErrorResponse(error, operation) {
  if (error instanceof ImportInputError || error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message, ...(error.batch ? { batch: error.batch } : {}) }, { status: error.status || 400 })
  }
  console.error(`Admin import ${operation} failed`, { code: error?.code, status: error?.status })
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export function validateImportId(value) {
  if (!isUUID(value)) throw new ImportInputError('id must be a UUID')
  return value
}

export function parseImportPagination(searchParams, maxPageSize) {
  const read = (name, fallback, max) => {
    const value = searchParams.get(name)
    if (value === null || value === '') return fallback
    if (!/^\d+$/.test(value)) throw new ImportInputError(`${name} must be a positive integer`)
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new ImportInputError(`${name} is out of range`)
    return parsed
  }
  return { page: read('page', 1, 100000), pageSize: read('pageSize', Math.min(20, maxPageSize), maxPageSize) }
}

export function validateImportStatus(value) {
  if (value && !IMPORT_STATUSES.has(value)) throw new ImportInputError('status is invalid')
  return value || ''
}

export async function readApprovalBody(request) {
  const body = await readJsonBody(request, 4096)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || body.confirm !== true) {
    throw new ImportInputError('confirm: true is required')
  }
  return body
}

export function readSourceReference(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.trim().length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ImportInputError('source_reference is invalid')
  }
  return value.trim()
}
