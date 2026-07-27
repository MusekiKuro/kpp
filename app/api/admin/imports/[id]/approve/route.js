import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { importErrorResponse, readApprovalBody, validateImportId } from '@/lib/import-api.mjs'
import { IMPORT_BATCH_SELECT } from '@/lib/import-staging-server.mjs'
import { ImportInputError } from '@/lib/import-staging.mjs'

export async function POST(request, { params }) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  try {
    const { id } = await params
    const batchId = validateImportId(id)
    await readApprovalBody(request)
    const { data: batch, error: batchError } = await auth.supabase.from('import_batches').select(IMPORT_BATCH_SELECT).eq('id', batchId).maybeSingle()
    if (batchError) throw batchError
    if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    if (!['parsed', 'needs_review'].includes(batch.status)) throw new ImportInputError(`Batch cannot be approved from ${batch.status} state`, 409)
    const { data: rows, error: rowsError } = await auth.supabase.from('import_rows').select('validation_errors').eq('batch_id', batchId)
    if (rowsError) throw rowsError
    const invalidRows = (rows || []).filter((row) => Array.isArray(row.validation_errors) && row.validation_errors.length > 0)
    if (invalidRows.length > 0) throw new ImportInputError(`Remove validation errors from ${invalidRows.length} row(s) before approval`)
    const { data: approved, error } = await auth.supabase.from('import_batches').update({ status: 'approved', approved_by: auth.user.id, approved_at: new Date().toISOString() }).eq('id', batchId).select(IMPORT_BATCH_SELECT).single()
    if (error) throw error
    return NextResponse.json({ batch: approved })
  } catch (error) {
    return importErrorResponse(error, 'batch approval')
  }
}
