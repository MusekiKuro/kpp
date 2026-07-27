import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { revalidateCatalog } from '@/lib/admin-catalog.mjs'
import { importErrorResponse, readApprovalBody, validateImportId } from '@/lib/import-api.mjs'
import { ImportInputError } from '@/lib/import-staging.mjs'

export async function POST(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id } = await params
    const batchId = validateImportId(id)
    await readApprovalBody(request)
    const { data: batch, error: batchError } = await auth.supabase.from('import_batches').select('id,status').eq('id', batchId).maybeSingle()
    if (batchError) throw batchError
    if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    if (!['approved', 'failed', 'completed'].includes(batch.status)) throw new ImportInputError(`Batch cannot be applied from ${batch.status} state`, 409)
    const { data: result, error } = await auth.supabase.rpc('apply_import_batch', { p_batch_id: batchId })
    if (error) {
      console.error('Admin import apply RPC failed', { code: error.code, status: error.status })
      throw new ImportInputError('Import apply is temporarily unavailable; retry after the migration is installed', 503)
    }
    if (result?.status === 'failed') return NextResponse.json({ result }, { status: 422 })
    revalidateCatalog()
    return NextResponse.json({ result })
  } catch (error) {
    return importErrorResponse(error, 'batch apply')
  }
}
