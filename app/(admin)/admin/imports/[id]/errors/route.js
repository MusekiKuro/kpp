import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { importErrorResponse, validateImportId } from '@/lib/import-api.mjs'
import { getBatchErrors } from '@/lib/import-staging-server.mjs'

export async function GET(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id } = await params
    const result = await getBatchErrors(auth.supabase, validateImportId(id))
    if (!result) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    return importErrorResponse(error, 'error report')
  }
}
