import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { importErrorResponse, validateImportStatus } from '@/lib/import-api.mjs'
import { listBatches } from '@/lib/import-staging-server.mjs'
import { handleImportUpload } from '@/lib/import-upload-handler.mjs'

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const status = validateImportStatus(request.nextUrl.searchParams.get('status'))
    const params = new URLSearchParams(request.nextUrl.searchParams)
    if (status) params.set('status', status)
    return NextResponse.json(await listBatches(auth.supabase, params))
  } catch (error) {
    return importErrorResponse(error, 'batch list')
  }
}

export { handleImportUpload }

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    return await handleImportUpload(request, { supabase: auth.supabase, userId: auth.user.id })
  } catch (error) {
    return importErrorResponse(error, 'source upload')
  }
}
