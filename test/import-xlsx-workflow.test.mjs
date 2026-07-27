import assert from 'node:assert/strict'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { handleImportUpload } from '../lib/import-upload-handler.mjs'
import { stageSource } from '../lib/import-staging-server.mjs'
import { inspectXlsx } from '../lib/import-xlsx.mjs'
import { hashSource, normalizeMapping } from '../lib/import-staging.mjs'

async function buildTestWorkbook() {
  const workbook = new ExcelJS.Workbook()

  // Sheet 1: MainSheet (550 rows with custom column headers)
  const sheet1 = workbook.addWorksheet('MainSheet')
  sheet1.addRow(['Артикул товара', 'Наименование (RU)', 'Код категории'])
  for (let i = 1; i <= 550; i++) {
    sheet1.addRow([`SKU-${i}`, `Товар ${i}`, 'office'])
  }

  // Sheet 2: SecondSheet (2 rows with different headers)
  const sheet2 = workbook.addWorksheet('SecondSheet')
  sheet2.addRow(['ProductSKU', 'ProductName', 'CatCode'])
  sheet2.addRow(['SKU-ALT-1', 'Alt Product 1', 'office'])
  sheet2.addRow(['SKU-ALT-2', 'Alt Product 2', 'office'])

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function createSyntheticRequest(formData, headers = {}) {
  return {
    headers: new Map([
      ['content-type', 'multipart/form-data; boundary=----TestBoundary'],
      ...Object.entries(headers),
    ]),
    async formData() {
      return formData
    },
  }
}

test('API Route Handler & Staging: handleImportUpload processes full XLSX through stageSource into mock Supabase', async () => {
  const buffer = await buildTestWorkbook()
  const file = new File([buffer], 'catalog-550.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const form = new FormData()
  form.append('file', file)
  form.append('sheet', 'MainSheet')
  form.append('mapping', JSON.stringify({
    'Артикул товара': ' sku ',
    'Наименование (RU)': 'name_ru',
    'Код категории': 'category_slug',
  }))

  const req = createSyntheticRequest(form)

  const insertedBatches = []
  const insertedRows = []

  const mockSupabase = {
    from(table) {
      if (table === 'import_batches') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: null }
                  },
                }
              },
            }
          },
          insert(batchData) {
            const batchRecord = { id: 'batch-550-real', ...batchData }
            insertedBatches.push(batchRecord)
            return {
              select() {
                return {
                  async single() {
                    return { data: batchRecord, error: null }
                  },
                }
              },
            }
          },
        }
      }
      if (table === 'products') {
        return {
          select() {
            return {
              async range() {
                return { data: [], error: null, count: 0 }
              },
            }
          },
        }
      }
      if (table === 'import_rows') {
        return {
          async insert(rows) {
            insertedRows.push(...rows)
            return { error: null }
          },
        }
      }
      throw new Error(`Unexpected Supabase table: ${table}`)
    },
  }

  // Execute REAL stageSource with mock Supabase
  const response = await handleImportUpload(req, {
    stageSourceFn: stageSource,
    supabase: mockSupabase,
    userId: '00000000-0000-4000-8000-000000000000',
  })

  const body = await response.json()
  assert.equal(response.status, 201)
  assert.equal(body.batch.id, 'batch-550-real')

  // Verification 1: result.summary.rows === 550 (calculated dynamically by parser)
  assert.equal(body.summary.rows, 550, 'Result summary.rows must equal 550 dynamically parsed rows')

  // Verification 2: exactly 550 rows inserted into mock Supabase
  assert.equal(insertedRows.length, 550, 'Exactly 550 rows must be inserted into import_rows')

  // Verification 3: last inserted row contains SKU-550
  const lastRow = insertedRows[insertedRows.length - 1]
  assert.equal(lastRow.raw_payload.sku, 'SKU-550', 'Last row raw_payload must contain SKU-550')
  assert.equal(lastRow.normalized_payload.sku, 'SKU-550', 'Last row normalized_payload must contain SKU-550')

  // Verification 4: correct sheet was selected (MainSheet row 550)
  assert.equal(lastRow.raw_payload.name_ru, 'Товар 550')
  assert.equal(lastRow.raw_payload.category_slug, 'office')

  // Verification 5: server applied mapping ('Артикул товара' -> 'sku', etc.)
  assert.equal(insertedRows[0].raw_payload.sku, 'SKU-1')
  assert.equal(insertedRows[0].raw_payload.name_ru, 'Товар 1')
  assert.equal(insertedRows[0].raw_payload['Артикул товара'], undefined, 'Raw column header must be mapped to normalized field name')
})

test('API Route Handler: rejects unexpected multipart upload fields', async () => {
  const form = new FormData()
  form.append('file', new File([Buffer.from('test')], 'test.xlsx'))
  form.append('unexpected_field', 'value')

  const req = createSyntheticRequest(form)

  await assert.rejects(
    () => handleImportUpload(req),
    (error) => error.message.includes('unexpected_field is not an allowed upload field'),
  )
})

test('API Route Handler: rejects malformed JSON mapping', async () => {
  const form = new FormData()
  form.append('file', new File([Buffer.from('test')], 'test.xlsx'))
  form.append('mapping', '{ invalid json')

  const req = createSyntheticRequest(form)

  await assert.rejects(
    () => handleImportUpload(req),
    (error) => error.message.includes('mapping must be a valid JSON object'),
  )
})

test('API Route Handler: rejects sheet and mapping parameters for non-XLSX uploads (JSON/CSV)', async () => {
  const jsonFile = new File([JSON.stringify([{ sku: 'SKU-1', name_ru: 'Test' }])], 'data.json', { type: 'application/json' })

  const formSheet = new FormData()
  formSheet.append('file', jsonFile)
  formSheet.append('sheet', 'Sheet1')

  await assert.rejects(
    () => handleImportUpload(createSyntheticRequest(formSheet)),
    (error) => error.message.includes('sheet parameter is only supported for XLSX files'),
  )

  const formMapping = new FormData()
  formMapping.append('file', jsonFile)
  formMapping.append('mapping', JSON.stringify({ col1: 'sku' }))

  await assert.rejects(
    () => handleImportUpload(createSyntheticRequest(formMapping)),
    (error) => error.message.includes('mapping parameter is only supported for XLSX files'),
  )
})

test('API Route Handler: rejects mapping for non-XLSX uploads even when mapping is empty or targets are empty', async () => {
  const jsonFile = new File([JSON.stringify([{ sku: 'SKU-1', name_ru: 'Test' }])], 'data.json', { type: 'application/json' })

  const formEmptyMap = new FormData()
  formEmptyMap.append('file', jsonFile)
  formEmptyMap.append('mapping', '{}')

  await assert.rejects(
    () => handleImportUpload(createSyntheticRequest(formEmptyMap)),
    (error) => error.status === 400 && error.message.includes('mapping parameter is only supported for XLSX files'),
  )

  const formEmptyTargets = new FormData()
  formEmptyTargets.append('file', jsonFile)
  formEmptyTargets.append('mapping', JSON.stringify({ col1: '   ' }))

  await assert.rejects(
    () => handleImportUpload(createSyntheticRequest(formEmptyTargets)),
    (error) => error.status === 400 && error.message.includes('mapping parameter is only supported for XLSX files'),
  )
})

test('API Route Handler & Staging: rejects unknown mapping source key before staging', async () => {
  const buffer = await buildTestWorkbook()
  const file = new File([buffer], 'catalog-550.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const form = new FormData()
  form.append('file', file)
  form.append('sheet', 'MainSheet')
  form.append('mapping', JSON.stringify({
    'Несуществующая колонка': 'sku',
  }))

  const req = createSyntheticRequest(form)

  await assert.rejects(
    () => handleImportUpload(req, { stageSourceFn: stageSource }),
    (error) => error.name === 'ImportInputError' && error.message.includes('does not match any column'),
  )
})

test('API Route Handler: rejects legacy .xls format with 415 HTTP status', async () => {
  const xlsFile = new File([Buffer.from('fake xls content')], 'legacy.xls', { type: 'application/vnd.ms-excel' })
  const form = new FormData()
  form.append('file', xlsFile)

  await assert.rejects(
    () => handleImportUpload(createSyntheticRequest(form)),
    (error) => error.status === 415 && error.message.includes('Only .json, .csv, and .xlsx files are supported'),
  )
})

test('Mapping Normalization: whitespace is trimmed and empty targets omitted', () => {
  const rawMapping = {
    ' Артикул ': ' sku ',
    ' Название ': ' name_ru ',
    ' Пустая ': '   ',
  }

  const normalized = normalizeMapping(rawMapping)
  assert.deepEqual(normalized, {
    'Артикул': 'sku',
    'Название': 'name_ru',
  })
})

test('Mapping Normalization: rejects conflicting source column keys after trim', () => {
  assert.throws(
    () => normalizeMapping({ ' A': 'sku', 'A ': 'name_ru' }),
    (error) => error.name === 'ImportInputError' && error.message.includes('duplicate source column key "A"'),
  )
})

test('Mapping Normalization: rejects empty source column key', () => {
  assert.throws(
    () => normalizeMapping({ '  ': 'sku' }),
    (error) => error.name === 'ImportInputError' && error.message.includes('source column key cannot be empty'),
  )
})

test('Idempotency Hashing: semantically identical mappings yield equal hashes regardless of key order or whitespace', () => {
  const buffer = Buffer.from('xlsx-dummy-content')

  const mapA = { 'Артикул': 'sku', 'Название': 'name_ru' }
  const mapB = { ' Название ': ' name_ru ', 'Артикул': ' sku ' } // different key order and extra spaces

  const hashA = hashSource(buffer, { sheet: 'Sheet1', mapping: mapA })
  const hashB = hashSource(buffer, { sheet: 'Sheet1', mapping: mapB })

  assert.equal(hashA, hashB, 'Semantically equal mappings must produce identical source hashes')
})
