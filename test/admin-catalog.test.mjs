import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  AdminCatalogValidationError,
  normalizeAdminProduct,
  parseAdminPageParams,
  validateAttributeCMSPayload,
  validateCategoryCMSPayload,
  validateProductCMSPayload,
} from '../lib/admin-catalog.mjs'

const seo = { ru: { title: 'RU title', description: 'RU description' }, kk: { title: 'KZ title', description: 'KZ description' } }

function product(overrides = {}) {
  return {
    sku: 'SKU-001', slug: 'test-product', category_id: '11111111-1111-4111-8111-111111111111', brand_id: null,
    name_ru: 'Тестовый товар', name_kk: 'Сынақ тауары', short_description_ru: 'Коротко', short_description_kk: 'Қысқа',
    description_ru: 'Описание', description_kk: 'Сипаттама', warranty_ru: null, warranty_kk: null,
    price: { mode: 'from', amount: 100, old_amount: null, currency: 'KZT' }, stock_status: 'in_stock',
    publication_status: 'draft', publish_ru: false, publish_kk: false, translation_status_kk: 'verified',
    is_featured: false, sort_order: 0, external_id: null, seo, attributes: [], ...overrides,
  }
}

test('T08 product validator keeps price modes, locale publication, and strict fields', () => {
  const result = validateProductCMSPayload(product({ publish_ru: true }))
  assert.equal(result.price.mode, 'from')
  assert.equal(result.price.currency, 'KZT')
  assert.equal(result.publish_ru, true)
  assert.throws(() => validateProductCMSPayload(product({ publish_kk: true, translation_status_kk: 'ai_draft' })), AdminCatalogValidationError)
  assert.throws(() => validateProductCMSPayload({ ...product(), unexpected: true }), AdminCatalogValidationError)
})

test('T08 quality pagination is server bounded and validates filters', () => {
  const params = new URLSearchParams('page=3&pageSize=100&quality=missing_kz&status=archived')
  const result = parseAdminPageParams(params)
  assert.deepEqual({ page: result.page, pageSize: result.pageSize, quality: result.quality, status: result.status }, { page: 3, pageSize: 50, quality: 'missing_kz', status: 'archived' })
  assert.throws(() => parseAdminPageParams(new URLSearchParams('quality=unknown')), AdminCatalogValidationError)
})

test('T08 category and attribute payloads validate localized CMS fields', () => {
  const category = validateCategoryCMSPayload({ slug: 'office', parent_id: null, name_ru: 'Офис', name_kk: 'Кеңсе', description_ru: null, description_kk: null, seo, sort_order: 0, status: 'draft' })
  assert.equal(category.seo.kk.title, 'KZ title')
  const attribute = validateAttributeCMSPayload({ category_id: null, code: 'width_mm', name_ru: 'Ширина', name_kk: 'Ені', data_type: 'number', unit_ru: 'мм', unit_kk: 'мм', is_filterable: true, sort_order: 1, status: 'published' })
  assert.equal(attribute.data_type, 'number')
})

test('T08 quality normalization reports missing catalog facts without changing source row', () => {
  const row = { id: 'p1', sku: null, name_ru: 'Legacy', name_kk: null, category_id: null, brand_id: null, image_url: null, price_mode: 'request', price_amount: null, old_price_amount: null, currency: 'KZT', product_images: [], product_attribute_values: [] }
  const result = normalizeAdminProduct(row)
  assert.deepEqual(result.quality_issues.sort(), ['missing_brand', 'missing_category', 'missing_image', 'missing_kz', 'missing_sku'])
  assert.equal(row.sku, null)
})

test('F04 migration defines updated_at triggers and atomic save_cms_product_attributes RPC with admin JWT check', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new URL('../supabase/migrations/20260724020000_add_cms_atomic_update_and_triggers.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.set_updated_at\(\)/)
  assert.match(sql, /BEFORE UPDATE ON public\.products/)
  assert.match(sql, /BEFORE UPDATE ON public\.categories/)
  assert.match(sql, /BEFORE UPDATE ON public\.brands/)
  assert.match(sql, /BEFORE UPDATE ON public\.attributes/)
  assert.match(sql, /BEFORE UPDATE ON public\.product_attribute_values/)
  assert.match(sql, /BEFORE UPDATE ON public\.product_images/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_cms_product_attributes/)
  assert.match(sql, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.save_cms_product_attributes\(UUID, JSONB, JSONB\) FROM PUBLIC/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_cms_product_attributes\(UUID, JSONB, JSONB\) TO authenticated/)
})

test('F04 saveCMSProductAtomic executes RPC atomically and returns 503 when RPC is missing without non-atomic fallback', async () => {
  const { saveCMSProductAtomic, AdminCatalogValidationError } = await import('../lib/admin-catalog.mjs')

  // 1. Success path calling RPC
  const mockSupabaseSuccess = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [{ id: 'attr-1', data_type: 'number', status: 'published' }], error: null }),
      }),
    }),
    rpc: async (name, params) => {
      assert.equal(name, 'save_cms_product_attributes')
      assert.equal(params.p_product_id, 'p1')
      return { data: { success: true, id: 'p1' }, error: null }
    },
  }

  const result = await saveCMSProductAtomic(mockSupabaseSuccess, 'p1', { name_ru: 'Test Product' }, [{ attribute_id: 'attr-1', value_number: 10 }])
  assert.deepEqual(result, { success: true, id: 'p1' })

  // 2. Missing RPC error (PGRST202) -> Must throw 503 schema not ready error, NO fallback!
  const mockSupabaseMissingRPC = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function save_cms_product_attributes' } }),
  }

  await assert.rejects(
    async () => saveCMSProductAtomic(mockSupabaseMissingRPC, 'p1', { name_ru: 'Test Product' }, []),
    (err) => err instanceof AdminCatalogValidationError && err.status === 503 && err.message.includes('503') || err.message.includes('schema not ready')
  )
})

test('F05 server-side attribute validation enforces strict data_type scoping, range bounds, and unique attribute_ids', () => {
  const attr1 = '10000000-0000-4000-8000-000000000001'
  const attr2 = '20000000-0000-4000-8000-000000000002'

  // Valid typed attributes
  const valid = validateProductCMSPayload(product({
    attributes: [
      { attribute_id: attr1, data_type: 'number', value_number: 42.5, value_text_ru: null, value_text_kk: null, value_boolean: null, value_option: null, raw_value: null },
      { attribute_id: attr2, data_type: 'boolean', value_boolean: true, value_text_ru: null, value_text_kk: null, value_number: null, value_option: null, raw_value: null },
    ],
  }))
  assert.equal(valid.attributes[0].value_number, 42.5)
  assert.equal(valid.attributes[1].value_boolean, true)

  // Duplicate attribute_id reject
  assert.throws(
    () => validateProductCMSPayload(product({
      attributes: [
        { attribute_id: attr1, data_type: 'text', value_text_ru: 'A', value_text_kk: null, value_number: null, value_boolean: null, value_option: null, raw_value: null },
        { attribute_id: attr1, data_type: 'text', value_text_ru: 'B', value_text_kk: null, value_number: null, value_boolean: null, value_option: null, raw_value: null },
      ],
    })),
    /unique/i,
  )

  // Out of bounds number reject
  assert.throws(
    () => validateProductCMSPayload(product({
      attributes: [
        { attribute_id: attr1, data_type: 'number', value_number: 9999999999, value_text_ru: null, value_text_kk: null, value_boolean: null, value_option: null, raw_value: null },
      ],
    })),
    /bounds/i,
  )

  // Conflicting typed values reject
  assert.throws(
    () => validateProductCMSPayload(product({
      attributes: [
        { attribute_id: attr1, value_number: 10, value_boolean: true, value_text_ru: null, value_text_kk: null, value_option: null, raw_value: null },
      ],
    })),
    /conflicting/i,
  )

  // data_type mismatch reject
  assert.throws(
    () => validateProductCMSPayload(product({
      attributes: [
        { attribute_id: attr1, data_type: 'number', value_boolean: true, value_text_ru: null, value_text_kk: null, value_number: null, value_option: null, raw_value: null },
      ],
    })),
    /number data_type/i,
  )
})

test('option attribute metadata uses a canonical unique string array', () => {
  const base = {
    category_id: null,
    code: 'color',
    name_ru: 'Цвет',
    name_kk: 'Түс',
    data_type: 'option',
    unit_ru: null,
    unit_kk: null,
    options: [' Красный ', 'Синий'],
    is_filterable: true,
    sort_order: 0,
    status: 'published',
  }

  assert.deepEqual(validateAttributeCMSPayload(base).options, ['Красный', 'Синий'])
  assert.throws(() => validateAttributeCMSPayload({ ...base, options: [] }), /at least one option/)
  assert.throws(() => validateAttributeCMSPayload({ ...base, options: ['A', 'A'] }), /unique/)
  assert.throws(() => validateAttributeCMSPayload({ ...base, options: [{ value: 'A' }] }), /must be a string/)
  assert.throws(() => validateAttributeCMSPayload({ ...base, data_type: 'text', options: ['A'] }), /only allowed/)
})

test('option attributes are editable in taxonomy CMS and rendered as a select in product CMS', async () => {
  const taxonomy = await readFile(new URL('../components/admin/TaxonomyCMS.js', import.meta.url), 'utf8')
  const products = await readFile(new URL('../components/admin/ProductCMS.js', import.meta.url), 'utf8')

  assert.match(taxonomy, /options_input/)
  assert.match(taxonomy, /options:\s*editor\.data_type === 'option'/)
  const optionEditor = products.slice(products.indexOf("dataType === 'option'"))
  assert.match(optionEditor, /<select/)
  assert.match(optionEditor, /attrMeta\?\.options/)
})




test('F04 enrichAndValidateProductAttributes fail-closed tests', async (t) => {
  const { enrichAndValidateProductAttributes } = await import('../lib/admin-catalog.mjs')

  // 1. DB metadata lookup error -> rejects
  let mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ error: { code: '500' } }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1' }]),
    { name: 'AdminCatalogValidationError', message: 'Unable to save catalog data' }
  )

  // 2. Unknown attribute_id -> rejects
  mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1' }]),
    { name: 'AdminCatalogValidationError', message: /does not exist/ }
  )

  // 3. Inactive attribute -> rejects
  mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'attr-1', status: 'draft', data_type: 'text' }] }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1' }]),
    { name: 'AdminCatalogValidationError', message: /is inactive/ }
  )

  // 4. Client data_type mismatch: boolean string "false" doesn't become true
  mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'attr-1', status: 'published', data_type: 'boolean' }] }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1', value_boolean: 'false' }]),
    { name: 'AdminCatalogValidationError', message: /must be a real boolean/ }
  )

  // 5. Option out of list -> rejects
  mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'attr-1', status: 'published', data_type: 'option', options: ['A', 'B'] }] }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1', value_option: 'C' }]),
    { name: 'AdminCatalogValidationError', message: /is not in allowed options/ }
  )

  // 6. Option with empty options -> config error
  mockSupabase = {
    from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'attr-1', status: 'published', data_type: 'option', options: [] }] }) }) })
  }
  await assert.rejects(
    async () => enrichAndValidateProductAttributes(mockSupabase, [{ attribute_id: 'attr-1', value_option: 'A' }]),
    { name: 'AdminCatalogValidationError', message: /has no options in database/ }
  )
})
