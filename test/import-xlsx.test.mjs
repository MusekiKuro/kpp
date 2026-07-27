import assert from 'node:assert/strict'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { inspectXlsx, parseXlsx } from '../lib/import-xlsx.mjs'
import { IMPORT_LIMITS } from '../lib/import-staging.mjs'
import { parseSource } from '../lib/import-staging-server.mjs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createXlsxBuffer(rows, headers, sheetCount = 1) {
  const workbook = new ExcelJS.Workbook()
  for (let s = 1; s <= sheetCount; s += 1) {
    const sheet = workbook.addWorksheet(`Sheet ${s}`)
    if (headers && headers.length) {
      sheet.addRow(headers)
    }
    if (rows && rows.length) {
      rows.forEach((row) => {
        sheet.addRow(row)
      })
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

async function createXlsxBufferMultiSheet(sheets) {
  const workbook = new ExcelJS.Workbook()
  for (const { name, headers, rows } of sheets) {
    const sheet = workbook.addWorksheet(name)
    if (headers) sheet.addRow(headers)
    if (rows) rows.forEach((r) => sheet.addRow(r))
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

// ---------------------------------------------------------------------------
// T1: Valid XLSX – basic parsing
// ---------------------------------------------------------------------------

test('parseXlsx parses valid XLSX workbook rows into normalized field objects', async () => {
  const headers = ['sku', 'name_ru', 'category_slug', 'price_mode', 'price_amount', 'publish_ru']
  const rows = [
    ['SKU-X01', 'Товар XLSX 1', 'office', 'exact', 12500.5, 'false'],
    ['SKU-X02', 'Товар XLSX 2', 'furniture', 'request', null, 'true'],
  ]
  const buffer = await createXlsxBuffer(rows, headers)
  const result = await parseXlsx(buffer)

  assert.equal(result.length, 2)
  assert.equal(result[0].sku, 'SKU-X01')
  assert.equal(result[0].name_ru, 'Товар XLSX 1')
  assert.equal(result[0].category_slug, 'office')
  assert.equal(result[0].price_mode, 'exact')
  assert.equal(result[0].price_amount, 12500.5)
  assert.equal(result[0].publish_ru, false)

  assert.equal(result[1].sku, 'SKU-X02')
  assert.equal(result[1].price_mode, 'request')
  assert.equal(result[1].publish_ru, true)
})

// ---------------------------------------------------------------------------
// T2: Multiple sheets + sheet selection (inspectXlsx)
// ---------------------------------------------------------------------------

test('inspectXlsx returns sheet list, active sheet, columns, and sample rows', async () => {
  const buffer = await createXlsxBufferMultiSheet([
    { name: 'Каталог 1', headers: ['Артикул', 'Наименование', 'Цена'], rows: [['SKU-001', 'Товар 1', 5000]] },
    { name: 'Каталог 2', headers: ['SKU', 'Name', 'Category'], rows: [['SKU-002', 'Product 2', 'office']] },
  ])

  const inspection1 = await inspectXlsx(buffer)
  assert.deepEqual(inspection1.sheets, ['Каталог 1', 'Каталог 2'])
  assert.equal(inspection1.activeSheet, 'Каталог 1')
  assert.deepEqual(inspection1.columns, ['Артикул', 'Наименование', 'Цена'])
  assert.equal(inspection1.sampleRows.length, 1)
  assert.equal(inspection1.totalRows, 1)

  const inspection2 = await inspectXlsx(buffer, { sheetName: 'Каталог 2' })
  assert.equal(inspection2.activeSheet, 'Каталог 2')
  assert.deepEqual(inspection2.columns, ['SKU', 'Name', 'Category'])
  assert.equal(inspection2.sampleRows[0].SKU, 'SKU-002')
  assert.equal(inspection2.totalRows, 1)
})

// ---------------------------------------------------------------------------
// T3: parseXlsx supports target sheet selection
// ---------------------------------------------------------------------------

test('parseXlsx supports target sheet selection', async () => {
  const buffer = await createXlsxBufferMultiSheet([
    { name: 'SheetA', headers: ['sku', 'name_ru', 'category_slug'], rows: [['SKU-A', 'Товар A', 'office']] },
    { name: 'SheetB', headers: ['sku', 'name_ru', 'category_slug'], rows: [['SKU-B', 'Товар B', 'furniture']] },
  ])

  const rowsB = await parseXlsx(buffer, { sheetName: 'SheetB' })
  assert.equal(rowsB.length, 1)
  assert.equal(rowsB[0].sku, 'SKU-B')
  assert.equal(rowsB[0].category_slug, 'furniture')
})

// ---------------------------------------------------------------------------
// T4: Empty header in the middle – must be rejected
// ---------------------------------------------------------------------------

test('parseXlsx rejects empty header between filled headers', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  // Explicitly set headers A=sku, B=empty, C=category_slug
  sheet.getCell('A1').value = 'sku'
  sheet.getCell('B1').value = null // empty
  sheet.getCell('C1').value = 'category_slug'
  sheet.addRow(['SKU-1', 'ignored', 'office'])

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  await assert.rejects(
    () => parseXlsx(buffer),
    /empty header between non-empty headers/i,
  )
})

// ---------------------------------------------------------------------------
// T5: Duplicate headers must be rejected
// ---------------------------------------------------------------------------

test('parseXlsx rejects duplicate headers', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  sheet.addRow(['sku', 'name_ru', 'sku'])
  sheet.addRow(['SKU-1', 'Name', 'SKU-1'])
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  await assert.rejects(
    () => parseXlsx(buffer),
    /duplicate header/i,
  )
})

// ---------------------------------------------------------------------------
// T6: Corrupt / non-XLSX data
// ---------------------------------------------------------------------------

test('parseXlsx rejects non-ZIP magic bytes buffer', async () => {
  const fakeBuffer = Buffer.from('NOT_A_ZIP_FILE_DATA_HERE')
  await assert.rejects(
    () => parseXlsx(fakeBuffer),
    /XLSX file signature is invalid/,
  )
})

test('parseXlsx rejects empty buffer', async () => {
  await assert.rejects(
    () => parseXlsx(Buffer.from('')),
    /XLSX source must be a non-empty buffer/,
  )
})

test('parseXlsx rejects plain ZIP file (not XLSX, missing OOXML marker)', () => {
  // Build a minimal valid ZIP with one file "dummy.txt" but NO [Content_Types].xml.
  // This simulates a plain ZIP (or non-OOXML archive) renamed to .xlsx.
  const filename = 'dummy.txt'
  const fileData = Buffer.from('hello')
  const fnLen = filename.length
  const dataLen = fileData.length

  const lhSize = 30 + fnLen + dataLen
  const cdSize = 46 + fnLen
  const cdStart = lhSize

  const buf = Buffer.alloc(lhSize + cdSize + 22)
  let off = 0

  // Local file header
  buf.writeUInt32LE(0x04034b50, off); off += 4
  buf.writeUInt16LE(20, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt32LE(0, off); off += 4
  buf.writeUInt32LE(dataLen, off); off += 4
  buf.writeUInt32LE(dataLen, off); off += 4
  buf.writeUInt16LE(fnLen, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.write(filename, off); off += fnLen
  fileData.copy(buf, off); off += dataLen

  // Central directory entry
  buf.writeUInt32LE(0x02014b50, off); off += 4
  buf.writeUInt16LE(20, off); off += 2
  buf.writeUInt16LE(20, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt32LE(0, off); off += 4
  buf.writeUInt32LE(dataLen, off); off += 4
  buf.writeUInt32LE(dataLen, off); off += 4
  buf.writeUInt16LE(fnLen, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt32LE(0, off); off += 4
  buf.writeUInt32LE(0, off); off += 4
  buf.write(filename, off); off += fnLen

  // End of central directory
  buf.writeUInt32LE(0x06054b50, off); off += 4
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(0, off); off += 2
  buf.writeUInt16LE(1, off); off += 2
  buf.writeUInt16LE(1, off); off += 2
  buf.writeUInt32LE(cdSize, off); off += 4
  buf.writeUInt32LE(cdStart, off); off += 4
  buf.writeUInt16LE(0, off); off += 2

  // Trim to actual written bytes
  const zipBuf = buf.subarray(0, off)

  return assert.rejects(
    () => parseXlsx(zipBuf),
    /OOXML/i,
  )
})

// ---------------------------------------------------------------------------
// T7: File size limit (unified IMPORT_LIMITS.maxSourceBytes)
// ---------------------------------------------------------------------------

test('parseXlsx rejects buffer exceeding IMPORT_LIMITS.maxSourceBytes', async () => {
  // Use a buffer just over the canonical limit
  const oversized = Buffer.alloc(IMPORT_LIMITS.maxSourceBytes + 1)
  // Set ZIP magic bytes so we reach the size check
  oversized[0] = 0x50; oversized[1] = 0x4b; oversized[2] = 0x03; oversized[3] = 0x04
  await assert.rejects(
    () => parseXlsx(oversized),
    new RegExp(`${IMPORT_LIMITS.maxSourceBytes} bytes`),
  )
})

test('error message for oversized XLSX matches actual IMPORT_LIMITS.maxSourceBytes', async () => {
  const oversized = Buffer.alloc(IMPORT_LIMITS.maxSourceBytes + 1)
  oversized[0] = 0x50; oversized[1] = 0x4b; oversized[2] = 0x03; oversized[3] = 0x04
  try {
    await parseXlsx(oversized)
    assert.fail('Should have thrown')
  } catch (err) {
    // Error message must cite the actual limit, not a different hardcoded value
    assert.ok(
      err.message.includes(String(IMPORT_LIMITS.maxSourceBytes)),
      `Error should mention ${IMPORT_LIMITS.maxSourceBytes} bytes, got: ${err.message}`,
    )
  }
})

// ---------------------------------------------------------------------------
// T8: File between old 5 MB and old 10 MB – proves no split-limit desync
// ---------------------------------------------------------------------------

test('XLSX between 5 MB and 10 MB uses one unified size limit (no split-limit desync)', async () => {
  // If IMPORT_LIMITS.maxSourceBytes is 5 MB, a 6 MB buffer should fail.
  // If it were somehow raised to 10 MB, a 6 MB buffer should pass.
  // Either way, the error message must cite IMPORT_LIMITS.maxSourceBytes.
  const sixMb = Buffer.alloc(6 * 1024 * 1024)
  sixMb[0] = 0x50; sixMb[1] = 0x4b; sixMb[2] = 0x03; sixMb[3] = 0x04

  const limit = IMPORT_LIMITS.maxSourceBytes

  if (sixMb.length > limit) {
    // Should be rejected at the limit
    await assert.rejects(
      () => parseXlsx(sixMb),
      new RegExp(String(limit)),
    )
  } else {
    // Limit is >= 6 MB: the test just verifies no double-standard message
    // The buffer is still invalid XLSX, so it will fail for other reasons.
    await assert.rejects(() => parseXlsx(sixMb), /XLSX|ZIP|corrupt|invalid|signature/i)
  }
})

// ---------------------------------------------------------------------------
// T9: Formula cells – cached value used, never executed
// ---------------------------------------------------------------------------

test('parseXlsx treats formula cells as raw text values and never executes them', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  sheet.addRow([
    'SKU-FORMULA',
    { formula: 'HYPERLINK("http://attacker.com")', result: '=HYPERLINK("http://attacker.com")' },
    'office',
  ])

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const result = await parseXlsx(buffer)

  assert.equal(result.length, 1)
  assert.equal(result[0].sku, 'SKU-FORMULA')
  assert.equal(result[0].name_ru, '=HYPERLINK("http://attacker.com")')
})

// ---------------------------------------------------------------------------
// T10: Long cell values (exceeds maxCellChars)
// ---------------------------------------------------------------------------

test('parseXlsx rejects cells exceeding maxCellChars', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  const longString = 'x'.repeat(IMPORT_LIMITS.maxCellChars + 1)
  sheet.addRow(['SKU-1', longString, 'office'])
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  await assert.rejects(
    () => parseXlsx(buffer),
    /exceeds maximum length/i,
  )
})

// ---------------------------------------------------------------------------
// T11: Row count limit
// ---------------------------------------------------------------------------

test('parseXlsx rejects worksheets exceeding maxRows', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  // Add maxRows + 1 data rows to push over the limit
  for (let i = 0; i < IMPORT_LIMITS.maxRows + 1; i++) {
    sheet.addRow([`SKU-${i}`, `Name ${i}`, 'office'])
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  await assert.rejects(
    () => parseXlsx(buffer),
    new RegExp(`${IMPORT_LIMITS.maxRows} rows`),
  )
})

// ---------------------------------------------------------------------------
// T12: Column count limit
// ---------------------------------------------------------------------------

test('parseXlsx rejects worksheets exceeding maxColumns', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet 1')
  // Build headers: use known import fields repeated beyond limit
  const knownFields = Array.from(new Set([
    'sku', 'name_ru', 'name_kk', 'category_slug', 'price_mode',
    'short_description_ru', 'short_description_kk', 'description_ru', 'description_kk',
    'brand_slug', 'publish_ru', 'publish_kk', 'price_amount', 'old_price_amount', 'stock_status',
    'publication_status', 'translation_status_kk', 'is_featured', 'currency', 'image_url',
    'source_type', 'source_reference', 'source_hash', 'external_id', 'slug',
  ]))
  // Fill to maxColumns + 1 with unique names (allowUnmappedHeaders to avoid field check)
  const headers = []
  for (let i = 0; i < IMPORT_LIMITS.maxColumns + 1; i++) {
    headers.push(`col_${i}`)
  }
  sheet.addRow(headers)
  sheet.addRow(headers.map((_, i) => `val_${i}`))
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  await assert.rejects(
    () => parseXlsx(buffer, { allowUnmappedHeaders: true }),
    new RegExp(`${IMPORT_LIMITS.maxColumns} columns`),
  )
})

// ---------------------------------------------------------------------------
// T13: More than 5 worksheets is rejected
// ---------------------------------------------------------------------------

test('parseXlsx rejects workbooks with more than 5 worksheets', async () => {
  const buffer = await createXlsxBuffer([['SKU-1']], ['sku'], 6)
  await assert.rejects(
    () => parseXlsx(buffer),
    /exceeds maximum limit of 5 worksheets/,
  )
})

// ---------------------------------------------------------------------------
// T14: Unmapped headers rejected by default
// ---------------------------------------------------------------------------

test('parseXlsx rejects unmapped headers without allowUnmappedHeaders', async () => {
  const buffer = await createXlsxBuffer([['SKU-1', 'Val']], ['sku', 'unsupported_field_name'])
  await assert.rejects(
    () => parseXlsx(buffer),
    /unrecognized header/i,
  )
})

// ---------------------------------------------------------------------------
// T15: 501+ rows – preview is limited but totalRows reflects full count
// ---------------------------------------------------------------------------

test('inspectXlsx totalRows is the full data count even when sampleRows is capped at 500', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Data')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  for (let i = 1; i <= 550; i++) {
    sheet.addRow([`SKU-${i}`, `Product ${i}`, 'office'])
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

  const result = await inspectXlsx(buffer)
  assert.equal(result.totalRows, 550, 'totalRows must reflect all 550 data rows')
  assert.equal(result.sampleRows.length, 500, 'sampleRows must be capped at 500')
})

test('parseXlsx parses all 501+ rows when given the full buffer', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Data')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  for (let i = 1; i <= 550; i++) {
    sheet.addRow([`SKU-${i}`, `Product ${i}`, 'office'])
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

  const rows = await parseXlsx(buffer)
  assert.equal(rows.length, 550, 'parseXlsx must return all 550 rows')
  assert.equal(rows[0].sku, 'SKU-1')
  assert.equal(rows[549].sku, 'SKU-550')
})

// ---------------------------------------------------------------------------
// T16: sampleRows and totalRows are distinct (preview does not equal staging)
// ---------------------------------------------------------------------------

test('inspectXlsx sampleRows.length and totalRows are independent fields', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Data')
  sheet.addRow(['sku', 'name_ru', 'category_slug'])
  for (let i = 1; i <= 10; i++) {
    sheet.addRow([`SKU-${i}`, `Product ${i}`, 'office'])
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

  const result = await inspectXlsx(buffer)
  assert.equal(result.totalRows, 10)
  assert.equal(result.sampleRows.length, 10)
  // Both happen to be equal here; the key is totalRows is explicitly set
  assert.ok('totalRows' in result)
  assert.ok('sampleRows' in result)
})

// ---------------------------------------------------------------------------
// T17: Decompression bomb guard (declared uncompressed sizes)
// ---------------------------------------------------------------------------

test('verifyXlsxSignature guard: normal XLSX should not be blocked', async () => {
  const buffer = await createXlsxBuffer([['SKU-1', 'Name', 'office']], ['sku', 'name_ru', 'category_slug'])
  // Should not throw
  const result = await parseXlsx(buffer)
  assert.ok(result.length >= 1)
})

// ---------------------------------------------------------------------------
// T18: parseSource integration – XLSX via parseSource
// ---------------------------------------------------------------------------

test('parseSource correctly identifies xlsx by filename and delegates to parseXlsx', async () => {
  const headers = ['sku', 'name_ru', 'category_slug']
  const rows = [['SKU-P1', 'Product 1', 'office']]
  const buffer = await createXlsxBuffer(rows, headers)

  const result = await parseSource(buffer, 'products.xlsx')
  assert.equal(result.sourceType, 'xlsx')
  assert.equal(result.rawRows.length, 1)
  assert.equal(result.rawRows[0].sku, 'SKU-P1')
})
