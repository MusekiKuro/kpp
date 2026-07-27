import {
  IMPORT_LIMITS,
  ImportInputError,
  buildFieldDiff,
  hashSource,
  normalizeRows,
  parseCsv,
  parseJson,
  sourceTypeFromFilename,
} from './import-staging.mjs'

export const IMPORT_BATCH_SELECT = 'id,source_type,source_filename,source_hash,status,created_by,approved_by,summary,created_at,approved_at,applied_at'
const MATCH_SELECT = [
  'id', 'sku', 'external_id', 'slug', 'category_id', 'brand_id', 'name', 'description', 'image_url',
  'name_ru', 'name_kk', 'short_description_ru', 'short_description_kk', 'description_ru', 'description_kk',
  'price_mode', 'price_amount', 'old_price_amount', 'currency', 'stock_status', 'publication_status',
  'publish_ru', 'publish_kk', 'translation_status_kk', 'is_featured', 'source_type', 'source_reference',
  'category:categories(slug)', 'brand:brands(slug)',
].join(',')

export function safeDatabaseError(operation, error) {
  console.error(`Import staging ${operation} failed`, { code: error?.code, status: error?.status })
  const wrapped = new ImportInputError('Import storage is temporarily unavailable', 503)
  wrapped.code = error?.code
  return wrapped
}

function normalizeRelation(value) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export async function loadMatchCandidates(supabase) {
  const { data, error, count } = await supabase.from('products').select(MATCH_SELECT, { count: 'exact' }).range(0, IMPORT_LIMITS.maxMatchCandidates - 1)
  if (error) throw safeDatabaseError('match candidates', error)
  if ((count || 0) > IMPORT_LIMITS.maxMatchCandidates) throw new ImportInputError(`Import matching is limited to ${IMPORT_LIMITS.maxMatchCandidates} products`, 413)
  return (data || []).map((row) => ({ ...row, category: normalizeRelation(row.category), brand: normalizeRelation(row.brand) }))
}

function safeFilename(value) {
  return String(value || 'import-source').split(/[\\/]/).pop().slice(0, 200) || 'import-source'
}

import { inspectXlsx, parseXlsx } from './import-xlsx.mjs'
import { mapImportRows } from './import-ui.mjs'

export async function parseSource(buffer, filename, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ImportInputError('Import file is empty')
  if (buffer.length > IMPORT_LIMITS.maxSourceBytes) throw new ImportInputError(`Import file exceeds ${IMPORT_LIMITS.maxSourceBytes} bytes`, 413)
  const sourceType = sourceTypeFromFilename(filename)
  if (!sourceType) throw new ImportInputError('Only .json, .csv, and .xlsx files are supported', 415)
  let rawRows
  if (sourceType === 'xlsx') {
    const preview = await inspectXlsx(buffer, { sheetName: options.sheet })
    if (options.mapping && typeof options.mapping === 'object') {
      const validColumns = new Set(preview.columns)
      for (const sourceKey of Object.keys(options.mapping)) {
        if (!validColumns.has(sourceKey)) {
          throw new ImportInputError(`Mapping source key "${sourceKey}" does not match any column in the selected worksheet`)
        }
      }
    }
    const rawParsed = await parseXlsx(buffer, { sheetName: options.sheet, allowUnmappedHeaders: true })
    if (options.mapping && typeof options.mapping === 'object') {
      try {
        rawRows = mapImportRows(rawParsed, options.mapping)
      } catch (err) {
        throw new ImportInputError(err.message)
      }
    } else {
      rawRows = rawParsed
    }
  } else {
    const text = buffer.toString('utf8')
    rawRows = sourceType === 'json' ? parseJson(text) : parseCsv(text)
  }
  return { sourceType, rawRows, sourceHash: hashSource(buffer, options), sourceFilename: safeFilename(filename) }
}

export async function stageSource({ supabase, userId, buffer, filename, sourceReference, sheet, mapping }) {
  const source = await parseSource(buffer, filename, { sheet, mapping })
  const reference = sourceReference === undefined || sourceReference === '' ? null : sourceReference
  const { data: duplicate, error: duplicateError } = await supabase.from('import_batches').select(IMPORT_BATCH_SELECT).eq('source_hash', source.sourceHash).maybeSingle()
  if (duplicateError) throw safeDatabaseError('duplicate source lookup', duplicateError)
  if (duplicate) {
    const error = new ImportInputError('This exact source has already been staged', 409)
    error.batch = duplicate
    throw error
  }
  const candidates = await loadMatchCandidates(supabase)
  const normalized = normalizeRows(source.rawRows, { sourceType: source.sourceType, sourceReference: reference, sourceHash: source.sourceHash, existingProducts: candidates })
  const status = normalized.summary.error > 0 ? 'needs_review' : 'parsed'
  const summary = {
    parser: source.sourceType,
    source_hash: source.sourceHash,
    source_filename: source.sourceFilename,
    source_reference: normalized.context.sourceReference,
    rows: normalized.summary.rows,
    actions: { create: normalized.summary.create, update: normalized.summary.update, skip: normalized.summary.skip, error: normalized.summary.error },
    warnings: normalized.summary.warnings,
    duplicates: normalized.summary.duplicate,
    apply: { created: 0, updated: 0, skipped: 0 },
  }
  const { data: batch, error: batchError } = await supabase.from('import_batches').insert({ source_type: source.sourceType, source_filename: source.sourceFilename, source_hash: source.sourceHash, status, created_by: userId, summary }).select(IMPORT_BATCH_SELECT).single()
  if (batchError) {
    if (batchError.code === '23505') {
      const duplicateErrorResult = new ImportInputError('This exact source has already been staged', 409)
      throw duplicateErrorResult
    }
    throw safeDatabaseError('batch create', batchError)
  }
  const rows = normalized.rows.map((row) => ({ batch_id: batch.id, ...row }))
  const { error: rowsError } = await supabase.from('import_rows').insert(rows)
  if (rowsError) {
    await supabase.from('import_batches').update({ status: 'failed', summary: { ...summary, status: 'failed', error: 'row staging failed' } }).eq('id', batch.id)
    throw safeDatabaseError('row staging', rowsError)
  }
  return { batch, summary, rows: normalized.rows }
}

export async function listBatches(supabase, searchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20))
  const status = searchParams.get('status') || ''
  const from = (page - 1) * pageSize
  let query = supabase.from('import_batches').select(IMPORT_BATCH_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (status) query = query.eq('status', status)
  const { data, error, count } = await query
  if (error) throw safeDatabaseError('batch list', error)
  return { items: data || [], pagination: { page, page_size: pageSize, total: count || 0, total_pages: count ? Math.ceil(count / pageSize) : 0 } }
}

export async function getBatch(supabase, batchId, { page = 1, pageSize = 100 } = {}) {
  const { data: batch, error: batchError } = await supabase.from('import_batches').select(IMPORT_BATCH_SELECT).eq('id', batchId).maybeSingle()
  if (batchError) throw safeDatabaseError('batch detail', batchError)
  if (!batch) return null
  const from = Math.max(0, page - 1) * Math.min(pageSize, 200)
  const limit = Math.min(pageSize, 200)
  const { data: rows, error: rowsError, count } = await supabase.from('import_rows').select('id,batch_id,row_number,raw_payload,normalized_payload,matched_product_id,proposed_action,validation_errors,validation_warnings,status,created_at,updated_at', { count: 'exact' }).eq('batch_id', batchId).order('row_number').range(from, from + limit - 1)
  if (rowsError) throw safeDatabaseError('row detail', rowsError)
  const ids = [...new Set((rows || []).map((row) => row.matched_product_id).filter(Boolean))]
  let existingById = new Map()
  if (ids.length) {
    const { data: products, error: productError } = await supabase.from('products').select(MATCH_SELECT).in('id', ids)
    if (productError) throw safeDatabaseError('preview products', productError)
    existingById = new Map((products || []).map((product) => [product.id, { ...product, category: normalizeRelation(product.category), brand: normalizeRelation(product.brand) }]))
  }
  const previewRows = (rows || []).map((row) => ({ ...row, diff: buildFieldDiff(row, existingById.get(row.matched_product_id) || null) }))
  return { batch, rows: previewRows, pagination: { page, page_size: limit, total: count || 0, total_pages: count ? Math.ceil(count / limit) : 0 } }
}

export async function getBatchErrors(supabase, batchId) {
  const { data: batch, error: batchError } = await supabase.from('import_batches').select(IMPORT_BATCH_SELECT).eq('id', batchId).maybeSingle()
  if (batchError) throw safeDatabaseError('error report batch lookup', batchError)
  if (!batch) return null
  const { data: rows, error: rowsError } = await supabase.from('import_rows')
    .select('id,row_number,raw_payload,normalized_payload,validation_errors,validation_warnings,status')
    .eq('batch_id', batchId).eq('proposed_action', 'error').order('row_number').range(0, IMPORT_LIMITS.maxRows - 1)
  if (rowsError) throw safeDatabaseError('error report rows', rowsError)
  return { batch, rows: rows || [] }
}
