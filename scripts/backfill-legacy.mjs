import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  isUUID,
  validateSku,
} from '../lib/domain-contracts.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_INPUT = path.resolve(SCRIPT_DIR, '../fixtures/legacy-products.json')

const LEGACY_FIELDS = new Set([
  'id',
  'name',
  'category',
  'description',
  'image_url',
  'sort_order',
  'source_sku',
  'source_brand',
])

// Only these source labels are trusted for brand assignment. Product names are
// never parsed as brands, and unmapped labels remain null with a review flag.
export const EXPLICIT_BRAND_MAPPINGS = Object.freeze({
  acer: Object.freeze({ slug: 'acer', name_ru: 'Acer' }),
  almacom: Object.freeze({ slug: 'almacom', name_ru: 'Almacom' }),
  artel: Object.freeze({ slug: 'artel', name_ru: 'Artel' }),
  beko: Object.freeze({ slug: 'beko', name_ru: 'Beko' }),
  hikvision: Object.freeze({ slug: 'hikvision', name_ru: 'Hikvision' }),
  hp: Object.freeze({ slug: 'hp', name_ru: 'HP' }),
  lg: Object.freeze({ slug: 'lg', name_ru: 'LG' }),
  lenovo: Object.freeze({ slug: 'lenovo', name_ru: 'Lenovo' }),
  newline: Object.freeze({ slug: 'newline', name_ru: 'Newline' }),
  oasis: Object.freeze({ slug: 'oasis', name_ru: 'Oasis' }),
  samsung: Object.freeze({ slug: 'samsung', name_ru: 'Samsung' }),
  xiaomi: Object.freeze({ slug: 'xiaomi', name_ru: 'Xiaomi' }),
})

const TRANSLITERATION = Object.freeze({
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
})

function compareStable(left, right) {
  const leftValue = String(left ?? '')
  const rightValue = String(right ?? '')
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function normalizeLabel(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ')
    : ''
}

function transliterate(value) {
  return [...value.toLowerCase()].map((character) => TRANSLITERATION[character] ?? character).join('')
}

export function slugify(value) {
  const ascii = transliterate(normalizeLabel(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
  const slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
  return slug || null
}

function stableHash(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function uniqueSlug(base, key, used) {
  if (!base) return null
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  const suffix = stableHash(key)
  let candidate = `${base}-${suffix}`.slice(0, 120).replace(/-+$/g, '')
  let counter = 2
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}-${counter}`.slice(0, 120).replace(/-+$/g, '')
    counter += 1
  }
  used.add(candidate)
  return candidate
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replaceAll("'", "''")}'`
}

function stableRowKey(row) {
  return [row.id, row.category, row.name, row.source_sku, row.source_brand]
    .map((value) => String(value ?? ''))
    .join('\u0000')
}

function validateLegacyRow(row, index) {
  const pathLabel = `rows[${index}]`
  const errors = []
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { errors: [`${pathLabel} must be an object`] }
  }

  for (const field of Object.keys(row)) {
    if (!LEGACY_FIELDS.has(field)) errors.push(`${pathLabel}.${field} is unknown`)
  }
  if (!isUUID(row.id)) errors.push(`${pathLabel}.id must be a UUID`)
  if (!normalizeLabel(row.name)) errors.push(`${pathLabel}.name is required`)
  if (!normalizeLabel(row.category)) errors.push(`${pathLabel}.category is required`)
  if (normalizeLabel(row.name) && !slugify(row.name)) errors.push(`${pathLabel}.name cannot produce a safe slug`)
  if (normalizeLabel(row.category) && !slugify(row.category)) errors.push(`${pathLabel}.category cannot produce a safe slug`)
  if (row.description !== undefined && row.description !== null && typeof row.description !== 'string') {
    errors.push(`${pathLabel}.description must be a string or null`)
  }
  if (row.image_url !== undefined && row.image_url !== null && typeof row.image_url !== 'string') {
    errors.push(`${pathLabel}.image_url must be a string or null`)
  }
  if (row.sort_order !== undefined && (!Number.isSafeInteger(row.sort_order) || row.sort_order < 0)) {
    errors.push(`${pathLabel}.sort_order must be a non-negative integer`)
  }
  if (row.source_brand !== undefined && row.source_brand !== null && typeof row.source_brand !== 'string') {
    errors.push(`${pathLabel}.source_brand must be a string or null`)
  }

  let sourceSku = null
  if (row.source_sku !== undefined && row.source_sku !== null && normalizeLabel(row.source_sku)) {
    try {
      sourceSku = validateSku(normalizeLabel(row.source_sku), `${pathLabel}.source_sku`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  return {
    errors,
    value: errors.length === 0
      ? {
        id: row.id,
        name: normalizeLabel(row.name),
        category: normalizeLabel(row.category),
        description: row.description === null ? null : normalizeLabel(row.description) || null,
        image_url: row.image_url === null || row.image_url === undefined ? null : normalizeLabel(row.image_url),
        sort_order: row.sort_order ?? 0,
        source_sku: sourceSku,
        source_brand: normalizeLabel(row.source_brand),
      }
      : null,
  }
}

function deriveCategories(rows) {
  const byKey = new Map()
  for (const row of rows) {
    const key = row.category.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, row.category)
  }

  const used = new Set()
  return [...byKey.entries()].sort(([left], [right]) => compareStable(left, right)).map(([key, name_ru]) => ({
    action: 'create',
    key,
    slug: uniqueSlug(slugify(name_ru), key, used),
    name_ru,
    name_kk: null,
    status: 'draft',
  }))
}

function resolveBrand(sourceBrand) {
  const key = normalizeLabel(sourceBrand).toLowerCase()
  return key ? EXPLICIT_BRAND_MAPPINGS[key] ?? null : null
}

function deriveBrands(rows) {
  const brands = new Map()
  for (const row of rows) {
    const mapping = resolveBrand(row.source_brand)
    if (mapping) brands.set(mapping.slug, { action: 'create', ...mapping, status: 'draft' })
  }
  return [...brands.values()].sort((left, right) => compareStable(left.slug, right.slug))
}

function deriveProductSlugs(rows) {
  const groups = new Map()
  for (const row of rows) {
    const base = slugify(row.name)
    if (!base) continue
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base).push(row)
  }

  const slugs = new Map()
  const used = new Set()
  for (const [base, group] of [...groups.entries()].sort(([left], [right]) => compareStable(left, right))) {
    for (const row of group.sort((left, right) => compareStable(left.id, right.id))) {
      const suffixKey = `${base}:${row.id}`
      slugs.set(row.id, uniqueSlug(base, suffixKey, used) || `${base}-${row.id.slice(0, 8)}`)
    }
  }
  return slugs
}

export function buildBackfillPlan(input) {
  if (!Array.isArray(input)) throw new Error('Fixture root must be an array')

  const sortedRows = [...input].sort((left, right) => compareStable(stableRowKey(left), stableRowKey(right)))
  const errors = []
  const validRows = []
  const seenIds = new Set()
  const skipped = []

  sortedRows.forEach((row, index) => {
    const validated = validateLegacyRow(row, index)
    if (validated.errors.length > 0) {
      errors.push({ action: 'error', row_index: index, id: row?.id ?? null, messages: validated.errors })
      return
    }
    if (seenIds.has(validated.value.id)) {
      skipped.push({ action: 'skip', id: validated.value.id, reason: 'duplicate_uuid' })
      return
    }
    seenIds.add(validated.value.id)
    validRows.push(validated.value)
  })

  const categories = deriveCategories(validRows)
  const categoryByKey = new Map(categories.map((category) => [category.key, category]))
  const brands = deriveBrands(validRows)
  const slugs = deriveProductSlugs(validRows)

  const products = validRows
    .sort((left, right) => compareStable(left.id, right.id))
    .map((row) => {
      const category = categoryByKey.get(row.category.toLowerCase())
      const brand = resolveBrand(row.source_brand)
      const review_flags = ['kz_translation_missing']
      if (!row.source_sku) review_flags.push('sku_missing')
      if (!brand) review_flags.push(row.source_brand ? 'brand_mapping_missing' : 'brand_missing')
      return {
        action: 'update',
        id: row.id,
        slug: slugs.get(row.id),
        category_slug: category.slug,
        brand_slug: brand?.slug ?? null,
        source_sku: row.source_sku,
        name_ru: row.name,
        description_ru: row.description,
        name_kk: null,
        description_kk: null,
        publication_status: 'draft',
        publish_ru: false,
        publish_kk: false,
        translation_status_kk: 'missing',
        review_flags,
      }
    })

  return {
    mode: 'dry-run',
    counts: {
      create: categories.length + brands.length,
      update: products.length,
      skip: skipped.length,
      error: errors.length,
    },
    categories,
    brands,
    products,
    skipped,
    errors,
  }
}

export function renderSeedSql(plan) {
  const lines = [
    '-- Generated locally by scripts/backfill-legacy.mjs.',
    '-- Review on staging before any human-approved database apply.',
    'BEGIN;',
  ]

  for (const category of plan.categories) {
    lines.push(
      `INSERT INTO public.categories (slug, name_ru, status) VALUES (${sqlLiteral(category.slug)}, ${sqlLiteral(category.name_ru)}, 'draft') ON CONFLICT (slug) DO NOTHING;`
    )
  }
  for (const brand of plan.brands) {
    lines.push(
      `INSERT INTO public.brands (slug, name, status) VALUES (${sqlLiteral(brand.slug)}, ${sqlLiteral(brand.name_ru)}, 'draft') ON CONFLICT (slug) DO NOTHING;`
    )
  }
  for (const product of plan.products) {
    const assignments = [
      `name_ru = COALESCE(p.name_ru, ${sqlLiteral(product.name_ru)})`,
      `description_ru = COALESCE(p.description_ru, ${sqlLiteral(product.description_ru)})`,
      `slug = COALESCE(p.slug, ${sqlLiteral(product.slug)})`,
      `category_id = COALESCE(p.category_id, (SELECT c.id FROM public.categories c WHERE c.slug = ${sqlLiteral(product.category_slug)}))`,
      `publication_status = COALESCE(p.publication_status, 'draft')`,
      `publish_ru = COALESCE(p.publish_ru, FALSE)`,
      `publish_kk = COALESCE(p.publish_kk, FALSE)`,
      `translation_status_kk = COALESCE(p.translation_status_kk, 'missing')`,
    ]
    if (product.source_sku) assignments.push(`sku = COALESCE(p.sku, ${sqlLiteral(product.source_sku)})`)
    if (product.brand_slug) {
      assignments.push(`brand_id = COALESCE(p.brand_id, (SELECT b.id FROM public.brands b WHERE b.slug = ${sqlLiteral(product.brand_slug)}))`)
    }
    lines.push(`UPDATE public.products p SET ${assignments.join(', ')} WHERE p.id = ${sqlLiteral(product.id)};`)
  }
  lines.push('COMMIT;')
  return `${lines.join('\n')}\n`
}

async function run() {
  const args = process.argv.slice(2)
  const inputIndex = args.indexOf('--input')
  const formatIndex = args.indexOf('--format')
  const inputPath = inputIndex >= 0 ? path.resolve(args[inputIndex + 1]) : DEFAULT_INPUT
  const format = formatIndex >= 0 ? args[formatIndex + 1] : 'json'
  if (!['json', 'sql'].includes(format)) throw new Error('--format must be json or sql')

  const input = JSON.parse(await readFile(inputPath, 'utf8'))
  const plan = buildBackfillPlan(input)
  process.stdout.write(format === 'sql' ? renderSeedSql(plan) : `${JSON.stringify({ input: inputPath, ...plan }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`Backfill dry-run failed: ${error.message}`)
    process.exitCode = 1
  })
}
