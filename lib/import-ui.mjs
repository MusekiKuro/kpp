export const IMPORT_UI_FIELDS = Object.freeze([
  'external_id', 'sku', 'slug', 'category_slug', 'brand_slug', 'name_ru', 'name_kk',
  'short_description_ru', 'short_description_kk', 'description_ru', 'description_kk',
  'price_mode', 'price_amount', 'old_price_amount', 'currency', 'stock_status',
  'publication_status', 'publish_ru', 'publish_kk', 'translation_status_kk', 'is_featured', 'image_url',
])

const ALIASES = new Map([
  ['артикул', 'sku'], ['article', 'sku'], ['product_code', 'sku'],
  ['название', 'name_ru'], ['наименование', 'name_ru'], ['name', 'name_ru'],
  ['категория', 'category_slug'], ['category', 'category_slug'],
  ['бренд', 'brand_slug'], ['brand', 'brand_slug'],
  ['цена', 'price_amount'], ['price', 'price_amount'],
  ['описание', 'description_ru'], ['description', 'description_ru'],
  ['изображение', 'image_url'], ['image', 'image_url'],
])

const MAX_UI_ROWS = 5000
const MAX_UI_COLUMNS = 64
const MAX_UI_CELL_CHARS = 10000
const NUMBER_FIELDS = new Set(['price_amount', 'old_price_amount'])
const BOOLEAN_FIELDS = new Set(['publish_ru', 'publish_kk', 'is_featured'])

function cell(value, rowNumber, column) {
  const result = value === null || value === undefined ? '' : String(value)
  if (result.length > MAX_UI_CELL_CHARS) throw new Error(`Row ${rowNumber}, ${column} exceeds the cell limit`)
  return result
}

export function parseDelimitedText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('CSV is empty')
  const rows = []
  let fields = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"' && field.length === 0) quoted = true
    else if (character === ',') { fields.push(field); field = '' }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      fields.push(field)
      if (fields.some((value) => value !== '')) rows.push(fields)
      fields = []
      field = ''
    } else field += character
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field')
  if (field.length > 0 || fields.length > 0) { fields.push(field); if (fields.some((value) => value !== '')) rows.push(fields) }
  if (!rows.length) throw new Error('CSV is empty')
  if (rows.length - 1 > MAX_UI_ROWS) throw new Error(`CSV exceeds ${MAX_UI_ROWS} rows`)
  if (rows[0].length > MAX_UI_COLUMNS) throw new Error(`CSV exceeds ${MAX_UI_COLUMNS} columns`)
  const headers = rows.shift().map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim())
  if (headers.some((header) => !header)) throw new Error('CSV contains an empty column name')
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names')
  if (rows.length === 0) throw new Error('CSV contains no data rows')
  return rows.map((values, rowIndex) => Object.fromEntries(headers.map((header, index) => [header, cell(values[index], rowIndex + 1, header)])))
}

export function parseImportText(text, filename) {
  const lower = String(filename || '').toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) throw new Error('XLSX is a binary format and must be parsed via server preview')
  if (lower.endsWith('.csv')) {
    const rows = parseDelimitedText(text)
    return { rows, columns: Object.keys(rows[0] || {}) }
  }
  if (!lower.endsWith('.json')) throw new Error('Choose a .json or .csv file')
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('JSON source is invalid') }
  const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.rows) ? parsed.rows : null
  if (!rows || rows.length === 0 || rows.length > MAX_UI_ROWS) throw new Error(`JSON rows must contain 1-${MAX_UI_ROWS} objects`)
  if (rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Every JSON row must be an object')
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  if (columns.length > MAX_UI_COLUMNS) throw new Error(`JSON exceeds ${MAX_UI_COLUMNS} columns`)
  rows.forEach((row, rowIndex) => columns.forEach((column) => { if (row[column] !== undefined) cell(row[column], rowIndex + 1, column) }))
  return { rows, columns }
}

export function suggestImportMapping(columns) {
  const used = new Set()
  return Object.fromEntries(columns.map((column) => {
    const normalized = String(column).trim().toLowerCase()
    const candidate = IMPORT_UI_FIELDS.includes(normalized) ? normalized : ALIASES.get(normalized) || ''
    if (!candidate || used.has(candidate)) return [column, '']
    used.add(candidate)
    return [column, candidate]
  }))
}

export function mapImportRows(rows, mapping) {
  const selected = Object.values(mapping).filter(Boolean)
  if (new Set(selected).size !== selected.length) throw new Error('Each normalized field can be mapped only once')
  return rows.map((row) => Object.fromEntries(Object.entries(mapping)
    .filter(([source, target]) => target && row[source] !== undefined)
    .map(([source, target]) => [target, normalizeMappedValue(target, row[source])])))
}

function normalizeMappedValue(target, value) {
  if (value === '') return null
  if (typeof value === 'string' && value.toLowerCase() === 'null') return null
  if (NUMBER_FIELDS.has(target)) {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (BOOLEAN_FIELDS.has(target)) {
    if (value === true || String(value).toLowerCase() === 'true') return true
    if (value === false || String(value).toLowerCase() === 'false') return false
  }
  return value
}

export function mappedFilename(filename) {
  const base = String(filename || 'import').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)
  return `${base || 'import'}.mapped.json`
}
