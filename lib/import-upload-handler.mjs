import { IMPORT_LIMITS, ImportInputError, normalizeMapping, sourceTypeFromFilename } from './import-staging.mjs'
import { readSourceReference } from './import-api.mjs'
import { stageSource } from './import-staging-server.mjs'
import { IMPORT_UI_FIELDS } from './import-ui.mjs'

const MAX_MULTIPART_OVERHEAD = 128 * 1024
const ALLOWED_MAPPED_FIELDS = new Set(IMPORT_UI_FIELDS)

export async function handleImportUpload(request, { stageSourceFn = stageSource, supabase, userId } = {}) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new ImportInputError('Import upload must use multipart/form-data')
  }
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > IMPORT_LIMITS.maxSourceBytes + MAX_MULTIPART_OVERHEAD) {
    throw new ImportInputError(`Import file exceeds ${IMPORT_LIMITS.maxSourceBytes} bytes`, 413)
  }
  const form = await request.formData()
  const allowedKeys = new Set(['file', 'source_reference', 'sheet', 'mapping'])
  for (const key of form.keys()) if (!allowedKeys.has(key)) throw new ImportInputError(`${key} is not an allowed upload field`)
  const file = form.get('file')
  if (!file || typeof file.arrayBuffer !== 'function') throw new ImportInputError('file is required')
  if (file.size > IMPORT_LIMITS.maxSourceBytes) throw new ImportInputError(`Import file exceeds ${IMPORT_LIMITS.maxSourceBytes} bytes`, 413)

  const filename = file.name
  const sourceType = sourceTypeFromFilename(filename)
  if (!sourceType) throw new ImportInputError('Only .json, .csv, and .xlsx files are supported', 415)

  const rawSheet = form.get('sheet')
  const sheet = rawSheet !== null && rawSheet !== undefined && String(rawSheet).trim() !== '' ? String(rawSheet).trim() : undefined

  const rawMapping = form.get('mapping')
  const hasMappingParam = rawMapping !== null && rawMapping !== undefined

  if (sourceType !== 'xlsx') {
    if (sheet !== undefined) throw new ImportInputError('sheet parameter is only supported for XLSX files')
    if (hasMappingParam) throw new ImportInputError('mapping parameter is only supported for XLSX files')
  }

  let mapping
  if (hasMappingParam && String(rawMapping).trim() !== '') {
    try {
      mapping = JSON.parse(String(rawMapping))
    } catch {
      throw new ImportInputError('mapping must be a valid JSON object')
    }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      throw new ImportInputError('mapping must be a valid JSON object')
    }
    const rawTargets = []
    for (const [col, target] of Object.entries(mapping)) {
      if (typeof target !== 'string') throw new ImportInputError(`mapping target for column "${col}" must be a string`)
      const trimmedTarget = target.trim()
      if (trimmedTarget !== '') {
        if (!ALLOWED_MAPPED_FIELDS.has(trimmedTarget)) throw new ImportInputError(`mapping target "${trimmedTarget}" is not a valid import field`)
        rawTargets.push(trimmedTarget)
      }
    }
    if (new Set(rawTargets).size !== rawTargets.length) {
      throw new ImportInputError('Each normalized field can be mapped only once')
    }
    mapping = normalizeMapping(mapping)
  }

  const sourceReference = readSourceReference(form.get('source_reference'))
  const result = await stageSourceFn({
    supabase,
    userId,
    buffer: Buffer.from(await file.arrayBuffer()),
    filename,
    sourceReference,
    sheet,
    mapping,
  })
  return Response.json({ batch: result.batch, summary: result.summary }, { status: 201 })
}
