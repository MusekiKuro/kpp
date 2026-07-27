import ExcelJS from 'exceljs'
import {
  IMPORT_LIMITS,
  ImportInputError,
  IMPORT_FIELDS,
} from './import-staging.mjs'

const IMPORT_FIELD_SET = new Set(IMPORT_FIELDS)
const BOOLEAN_FIELDS = new Set(['publish_ru', 'publish_kk', 'is_featured'])
const NUMBER_FIELDS = new Set(['price_amount', 'old_price_amount'])
const NULLABLE_FIELDS = new Set([
  'source_reference', 'external_id', 'sku', 'slug', 'brand_slug', 'name_kk', 'short_description_ru',
  'short_description_kk', 'description_ru', 'description_kk', 'price_amount', 'old_price_amount', 'image_url',
])

// Maximum allowed ZIP entries for an XLSX document (structural limit).
const MAX_ZIP_ENTRIES = 1024
// Maximum total uncompressed size of all ZIP entries (decompression bomb guard).
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024 // 50 MB
// Maximum uncompressed size of a single ZIP entry.
const MAX_SINGLE_ENTRY_BYTES = 20 * 1024 * 1024 // 20 MB
// OOXML mandatory entry that must be present in a real XLSX file.
const OOXML_MARKER = '[Content_Types].xml'

function fail(message, status = 400) {
  throw new ImportInputError(message, status)
}

/**
 * Parses the Central Directory of a raw ZIP buffer to enumerate entries
 * without decompressing them.  Returns an array of
 * { name, compressedSize, uncompressedSize }.
 *
 * This is a minimal, safe implementation: it walks the End-of-Central-Directory
 * record to find the CD offset, then iterates CD entries.  No decompression
 * occurs; we only read header metadata.
 */
function parseZipDirectory(buffer) {
  // Locate End of Central Directory (EOCD) signature: PK\x05\x06
  // The EOCD is at most 22 + 65535 bytes from the end.
  const EOCD_SIG = 0x06054b50
  const CD_SIG = 0x02014b50
  let eocdOffset = -1
  const minEocd = Math.max(0, buffer.length - 65535 - 22)
  for (let i = buffer.length - 22; i >= minEocd; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) return null // Not a ZIP or truncated

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16)
  const cdSize = buffer.readUInt32LE(eocdOffset + 12)
  if (cdOffset + cdSize > buffer.length) return null

  const entries = []
  let pos = cdOffset
  while (pos < cdOffset + cdSize) {
    if (buffer.length < pos + 46) break
    if (buffer.readUInt32LE(pos) !== CD_SIG) break
    const compressedSize = buffer.readUInt32LE(pos + 20)
    const uncompressedSize = buffer.readUInt32LE(pos + 24)
    const fileNameLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)
    let name = ''
    try { name = buffer.subarray(pos + 46, pos + 46 + fileNameLen).toString('utf8') } catch { /* ignore */ }
    entries.push({ name, compressedSize, uncompressedSize })
    pos += 46 + fileNameLen + extraLen + commentLen
  }
  return entries
}

/**
 * Validates ZIP structure, magic bytes, OOXML marker, and resource limits
 * BEFORE any decompression.  Throws ImportInputError on any failure.
 */
function verifyXlsxSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    fail('XLSX source must be a non-empty buffer')
  }

  // Use the single canonical limit from IMPORT_LIMITS
  if (buffer.length > IMPORT_LIMITS.maxSourceBytes) {
    fail(
      `XLSX file exceeds maximum size limit of ${IMPORT_LIMITS.maxSourceBytes} bytes`,
      413,
    )
  }

  // ZIP magic bytes: PK\x03\x04
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    fail('XLSX file signature is invalid (must be a valid .xlsx ZIP archive)')
  }

  // Parse the ZIP Central Directory for preflight checks
  const entries = parseZipDirectory(buffer)

  if (!entries) {
    // Buffer appears ZIP-magic but directory is unreadable – treat as corrupt
    fail('XLSX file is corrupt or not a valid ZIP archive')
  }

  if (entries.length === 0) {
    fail('XLSX file contains an empty ZIP archive')
  }

  if (entries.length > MAX_ZIP_ENTRIES) {
    fail(`XLSX file exceeds maximum of ${MAX_ZIP_ENTRIES} ZIP entries`, 413)
  }

  // Decompression bomb guard: check declared uncompressed sizes before extraction
  let totalUncompressed = 0
  for (const entry of entries) {
    if (entry.uncompressedSize > MAX_SINGLE_ENTRY_BYTES) {
      fail(
        `XLSX ZIP entry "${entry.name}" declares an uncompressed size exceeding ${MAX_SINGLE_ENTRY_BYTES} bytes`,
        413,
      )
    }
    totalUncompressed += entry.uncompressedSize
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      fail(
        `XLSX ZIP total uncompressed size exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`,
        413,
      )
    }
  }

  // OOXML structure check: [Content_Types].xml must be present
  const hasOoxml = entries.some((e) => e.name === OOXML_MARKER)
  if (!hasOoxml) {
    fail('XLSX file is not a valid OOXML document (missing [Content_Types].xml)')
  }
}

function extractCellValue(cell, field) {
  if (cell === null || cell === undefined) return ''

  let value = cell.value

  // Handle ExcelJS Formula objects safely: extract cached result, never execute
  if (value && typeof value === 'object') {
    if ('result' in value) {
      // formula cell – use cached result only, never evaluate
      value = value.result
    } else if ('text' in value) {
      value = value.text
    } else if (value instanceof Date) {
      value = value.toISOString().split('T')[0]
    } else if (Array.isArray(value.richText)) {
      value = value.richText.map((part) => part.text).join('')
    }
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  if (value === null || value === undefined) return ''

  let strVal = String(value).trim()

  if (strVal.length > IMPORT_LIMITS.maxCellChars) {
    fail(`Cell value in field '${field}' exceeds maximum length of ${IMPORT_LIMITS.maxCellChars} characters`)
  }

  return strVal
}

function typedXlsxValue(field, rawValue) {
  if (rawValue === '') return undefined
  if (rawValue === 'null' && NULLABLE_FIELDS.has(field)) return null

  if (BOOLEAN_FIELDS.has(field)) {
    const lower = rawValue.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') return true
    if (lower === 'false' || lower === '0' || lower === 'no') return false
  }

  if (NUMBER_FIELDS.has(field)) {
    const number = Number(rawValue)
    if (Number.isFinite(number)) return number
  }

  return rawValue
}

async function loadWorkbook(buffer) {
  verifyXlsxSignature(buffer)
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch (error) {
    fail(`XLSX source is invalid or corrupted: ${error.message}`)
  }

  if (workbook.worksheets.length === 0) {
    fail('XLSX workbook contains no worksheets')
  }

  if (workbook.worksheets.length > 5) {
    fail('XLSX workbook exceeds maximum limit of 5 worksheets', 413)
  }

  return workbook
}

function selectWorksheet(workbook, targetSheetName) {
  if (targetSheetName) {
    const found = workbook.getWorksheet(targetSheetName)
    if (found) return found
    fail(`Worksheet "${targetSheetName}" not found in workbook`)
  }
  return workbook.worksheets[0]
}

/**
 * Parses the header row and returns a Map<colNumber (1-based), headerString>.
 * Empty headers BETWEEN filled headers are rejected.
 * Trailing empty columns are ignored (to handle sparse sheets).
 * Duplicate normalized headers are rejected.
 *
 * Returns { headerMap, lastFilledCol } where headerMap: Map<colNumber, headerString>
 */
function parseHeaders(worksheet, options = {}) {
  const headerRow = worksheet.getRow(1)
  // Collect all cells present (non-empty) in row 1
  const rawHeaders = [] // { colNumber, value }

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > IMPORT_LIMITS.maxColumns) {
      fail(`XLSX exceeds ${IMPORT_LIMITS.maxColumns} columns limit`, 413)
    }
    let headerStr = String(cell.value || '').trim()
    if (colNumber === 1) headerStr = headerStr.replace(/^\uFEFF/, '')
    rawHeaders.push({ colNumber, value: headerStr })
  })

  // Determine the maximum column number with a non-empty header
  const filledHeaders = rawHeaders.filter((h) => h.value !== '')

  if (filledHeaders.length === 0) {
    fail('XLSX sheet contains no header row')
  }

  if (filledHeaders.length > IMPORT_LIMITS.maxColumns) {
    fail(`XLSX exceeds ${IMPORT_LIMITS.maxColumns} columns limit`, 413)
  }

  const maxFilledCol = filledHeaders[filledHeaders.length - 1].colNumber

  // Build a colNumber→header map for all columns in the range [1, maxFilledCol]
  // Empty headers within that range are a hard error (would shift column indices).
  const headerMap = new Map()
  for (let col = 1; col <= maxFilledCol; col++) {
    const entry = rawHeaders.find((h) => h.colNumber === col)
    const value = entry ? entry.value : ''
    if (value === '') {
      fail(`XLSX column ${col} has an empty header between non-empty headers`)
    }
    headerMap.set(col, value)
  }

  // Duplicate normalized header check
  const seen = new Set()
  for (const [col, header] of headerMap) {
    if (seen.has(header)) {
      fail(`XLSX contains duplicate header "${header}" (column ${col})`)
    }
    seen.add(header)
  }

  // Validate headers against known import fields (unless allowUnmappedHeaders)
  if (!options.allowUnmappedHeaders) {
    for (const [col, header] of headerMap) {
      if (!IMPORT_FIELD_SET.has(header)) {
        fail(`XLSX column ${col} has unrecognized header "${header}"; headers must use normalized import field names`)
      }
    }
  }

  return { headerMap, lastFilledCol: maxFilledCol }
}

/**
 * Count actual (non-empty) data rows in the worksheet, excluding the header row.
 * An empty row is one where every cell in the header columns is blank.
 */
function countDataRows(worksheet, headerMap) {
  const rowCount = worksheet.rowCount
  let count = 0
  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r)
    let hasData = false
    for (const [col] of headerMap) {
      const cell = row.getCell(col)
      const raw = extractCellValue(cell, '')
      if (raw !== '') { hasData = true; break }
    }
    if (hasData) count++
  }
  return count
}

export async function parseXlsx(buffer, options = {}) {
  const workbook = await loadWorkbook(buffer)
  const worksheet = selectWorksheet(workbook, options.sheetName)
  const rowCount = worksheet.rowCount

  if (rowCount === 0) {
    fail('XLSX sheet is empty')
  }

  if (rowCount > IMPORT_LIMITS.maxRows + 1) {
    fail(`XLSX exceeds ${IMPORT_LIMITS.maxRows} rows limit`, 413)
  }

  const { headerMap } = parseHeaders(worksheet, options)

  const rows = []

  for (let r = 2; r <= rowCount; r += 1) {
    const rowObj = {}
    const row = worksheet.getRow(r)
    let hasData = false

    for (const [col, header] of headerMap) {
      const cell = row.getCell(col)
      const rawStr = extractCellValue(cell, header)
      if (rawStr !== '') {
        hasData = true
        const typedVal = typedXlsxValue(header, rawStr)
        if (typedVal !== undefined) {
          rowObj[header] = typedVal
        }
      }
    }

    if (hasData) {
      rows.push(rowObj)
    }
  }

  if (rows.length === 0) {
    fail('XLSX sheet contains no data rows')
  }

  return rows
}

export async function inspectXlsx(buffer, options = {}) {
  const workbook = await loadWorkbook(buffer)
  const sheets = workbook.worksheets.map((s) => s.name)
  const worksheet = selectWorksheet(workbook, options.sheetName)
  const activeSheet = worksheet.name
  const rowCount = worksheet.rowCount

  if (rowCount === 0) {
    fail('XLSX sheet is empty')
  }

  if (rowCount > IMPORT_LIMITS.maxRows + 1) {
    fail(`XLSX exceeds ${IMPORT_LIMITS.maxRows} rows limit`, 413)
  }

  const { headerMap } = parseHeaders(worksheet, { allowUnmappedHeaders: true })

  // totalRows = actual count of non-empty data rows (not capped to sample size)
  const totalRows = countDataRows(worksheet, headerMap)

  const sampleRows = []
  const maxSample = Math.min(rowCount, 501) // include up to 500 data rows as sample

  for (let r = 2; r <= maxSample; r += 1) {
    if (sampleRows.length >= 500) break
    const rowObj = {}
    const row = worksheet.getRow(r)
    let hasData = false

    for (const [col, header] of headerMap) {
      const cell = row.getCell(col)
      const rawStr = extractCellValue(cell, header)
      if (rawStr !== '') {
        hasData = true
        rowObj[header] = rawStr
      }
    }

    if (hasData) {
      sampleRows.push(rowObj)
    }
  }

  return {
    sheets,
    activeSheet,
    columns: [...headerMap.values()],
    sampleRows,
    totalRows, // actual data rows in the full sheet, separate from sampleRows.length
  }
}
