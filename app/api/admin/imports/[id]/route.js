import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { importErrorResponse, parseImportPagination, validateImportId } from '@/lib/import-api.mjs'
import { getBatch } from '@/lib/import-staging-server.mjs'

export async function GET(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id } = await params
    const batchId = validateImportId(id)
    const pagination = parseImportPagination(request.nextUrl.searchParams, 200)
    const result = await getBatch(auth.supabase, batchId, pagination)
    if (!result) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    return importErrorResponse(error, 'batch detail')
  }
}
