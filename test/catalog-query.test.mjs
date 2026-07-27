import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  DEFAULT_PAGE_SIZE,
  MAX_ATTRIBUTE_FILTERS,
  MAX_PAGE_SIZE,
  CatalogQueryValidationError,
  catalogQueryKey,
  parseCatalogQuery,
} from '../lib/catalog/query-parser.mjs'
import { toPublicProductDTO, toPublicProductDetailDTO } from '../lib/catalog/dto.mjs'

test('catalog query parser applies safe defaults and supported filters', () => {
  const query = parseCatalogQuery(new URLSearchParams([
    ['q', '  Lenovo IdeaPad  '],
    ['category', 'laptops'],
    ['brand', 'lenovo'],
    ['stock', 'in_stock'],
    ['price_mode', 'from'],
    ['min_price', '100000'],
    ['max_price', '250000.50'],
    ['sort', 'price_asc'],
    ['page', '2'],
    ['page_size', '48'],
    ['attr.ram_gb', '16'],
  ]))

  assert.equal(query.q, 'Lenovo IdeaPad')
  assert.equal(query.page_size, 48)
  assert.equal(query.min_price, 100000)
  assert.equal(query.max_price, 250000.5)
  assert.equal(query.attributes.ram_gb, '16')
  assert.equal(query.sort, 'price_asc')
})

test('catalog query parser enforces page bounds and rejects unknown or repeated parameters', () => {
  assert.equal(parseCatalogQuery('').page_size, DEFAULT_PAGE_SIZE)
  assert.throws(() => parseCatalogQuery(`page_size=${MAX_PAGE_SIZE + 1}`), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('unknown=value'), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('brand=one&brand=two'), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('q=one%2Ctwo'), CatalogQueryValidationError)
})

test('catalog query parser rejects unsafe or contradictory filters', () => {
  assert.throws(() => parseCatalogQuery('q=%25admin%25'), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('category=Not-A-Slug'), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('min_price=20&max_price=10'), CatalogQueryValidationError)
  assert.throws(() => parseCatalogQuery('attr.bad-code=value'), CatalogQueryValidationError)
})

test('catalog query parser limits the number of attribute filters', () => {
  const params = new URLSearchParams()
  for (let index = 0; index <= MAX_ATTRIBUTE_FILTERS; index++) {
    params.set(`attr.code_${index}`, 'value')
  }
  assert.throws(() => parseCatalogQuery(params), /at most/)
})

test('catalog query keys are deterministic regardless of attribute insertion order', () => {
  const left = parseCatalogQuery('attr.color=black&attr.ram_gb=16')
  const right = parseCatalogQuery('attr.ram_gb=16&attr.color=black')
  assert.equal(catalogQueryKey(left), catalogQueryKey(right))
})

test('public product DTO excludes publication, import, and source fields', () => {
  const dto = toPublicProductDTO({
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'laptop-1',
    sku: 'SKU-1',
    name_ru: 'Laptop',
    name_kk: 'Ноутбук',
    short_description_ru: 'Short',
    short_description_kk: 'Қысқа',
    description_ru: 'Description',
    description_kk: 'Сипаттама',
    price_mode: 'request',
    price_amount: null,
    old_price_amount: null,
    currency: 'KZT',
    stock_status: 'unknown',
    image_url: 'https://example.com/laptop.jpg',
    category: { slug: 'laptops' },
    brand: { slug: 'lenovo' },
    publication_status: 'published',
    publish_ru: true,
    source_hash: 'must-not-leak',
  }, 'ru')

  assert.deepEqual(Object.keys(dto).sort(), [
    'brand_slug',
    'category_slug',
    'description',
    'id',
    'image_url',
    'locale',
    'name',
    'price',
    'short_description',
    'sku',
    'slug',
    'stock_status',
  ])
  assert.equal(dto.publication_status, undefined)
  assert.equal(dto.price.currency, 'KZT')
})

test('public product detail DTO exposes only localized gallery and structured specs', () => {
  const dto = toPublicProductDetailDTO({
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'laptop-1',
    sku: null,
    name_ru: 'Laptop',
    name_kk: 'Ноутбук',
    short_description_ru: null,
    short_description_kk: null,
    description_ru: null,
    description_kk: null,
    price_mode: 'hidden',
    price_amount: null,
    old_price_amount: null,
    currency: 'KZT',
    stock_status: 'unknown',
    image_url: null,
    category: { slug: 'laptops' },
    brand: null,
    product_images: [{
      id: 'image-1',
      storage_path: 'laptops/one.jpg',
      source_url: null,
      alt_ru: 'Laptop front',
      alt_kk: 'Ноутбук алды',
      sort_order: 0,
      is_primary: true,
    }],
    product_attribute_values: [{
      value_text_ru: '16 ГБ',
      value_text_kk: '16 ГБ',
      attribute: { code: 'ram', name_ru: 'ОЗУ', name_kk: 'Жедел жад', unit_ru: null, unit_kk: null, sort_order: 1 },
    }],
  }, 'kk', { storageBaseUrl: 'https://example.supabase.co' })

  assert.deepEqual(dto.gallery, [{ id: 'image-1', url: 'https://example.supabase.co/storage/v1/object/public/product-images/laptops/one.jpg', alt: 'Ноутбук алды', sort_order: 0, is_primary: true }])
  assert.deepEqual(dto.specs, [{ code: 'ram', name: 'Жедел жад', value: '16 ГБ', unit: null }])
  assert.equal(dto.source_url, undefined)
})

test('F02 secure catalog boundary migration drops public direct read on base products table and defines public_products view', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260724000000_secure_catalog_boundary.sql', import.meta.url), 'utf8')
  assert.match(sql, /DROP POLICY IF EXISTS "Public read published products" ON public\.products/)
  assert.match(sql, /CREATE OR REPLACE VIEW public\.public_products AS/)
  assert.match(sql, /GRANT SELECT ON public\.public_products TO anon, authenticated/)
  const viewSql = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW public.public_products'))
  assert.doesNotMatch(viewSql, /\bexternal_id\b/i)
  assert.doesNotMatch(viewSql, /\bsource_reference\b/i)
  assert.doesNotMatch(viewSql, /\bsource_hash\b/i)
  assert.match(viewSql, /CASE WHEN p\.price_mode IN \('exact', 'from'\) THEN p\.price_amount ELSE NULL END AS price_amount/)
})

test('public attribute filters use a restricted SECURITY DEFINER RPC instead of direct child-table reads', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260724040000_complete_catalog_runtime_contracts.sql', import.meta.url), 'utf8')
  const repository = await readFile(new URL('../lib/catalog/repository.mjs', import.meta.url), 'utf8')

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_published_product_ids_by_attributes/)
  assert.match(migration, /JOIN public\.products p ON p\.id = pav\.product_id/)
  assert.match(migration, /JOIN public\.categories c ON c\.id = p\.category_id/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_published_product_ids_by_attributes\(TEXT, JSONB\) TO anon, authenticated/)
  assert.doesNotMatch(repository, /\.from\(['"]product_attribute_values['"]\)/)
  assert.match(repository, /rpc\('get_published_product_ids_by_attributes'/)
})

test('getPublishedProducts resolves attribute filters through the restricted RPC', async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key'
  const { getPublishedProducts } = await import('../lib/catalog/repository.mjs')
  const originalFetch = globalThis.fetch
  const calls = []

  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input)
    calls.push({ url, options })
    if (url.includes('/rest/v1/attributes')) {
      return new Response(JSON.stringify([{
        id: '10000000-0000-4000-8000-000000000001',
        code: 'ram_gb',
        data_type: 'number',
        is_filterable: true,
        status: 'published',
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('/rest/v1/rpc/get_published_product_ids_by_attributes')) {
      assert.deepEqual(JSON.parse(options.body), { p_locale: 'ru', p_filters: { ram_gb: '16' } })
      return new Response(JSON.stringify([{ product_id: '20000000-0000-4000-8000-000000000001' }]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('/rest/v1/public_products')) {
      return new Response(JSON.stringify([{
        id: '20000000-0000-4000-8000-000000000001',
        slug: 'filtered-product',
        sku: 'FILTER-001',
        name_ru: 'Отфильтрованный товар',
        name_kk: null,
        short_description_ru: null,
        short_description_kk: null,
        description_ru: null,
        description_kk: null,
        price_mode: 'request',
        price_amount: null,
        old_price_amount: null,
        currency: 'KZT',
        stock_status: 'unknown',
        image_url: null,
        category_id: '30000000-0000-4000-8000-000000000001',
        brand_id: null,
        is_featured: false,
        sort_order: 0,
        created_at: '2026-07-24T00:00:00.000Z',
        category: { id: '30000000-0000-4000-8000-000000000001', slug: 'catalog', name_ru: 'Каталог', name_kk: null, status: 'published', parent_id: null, sort_order: 0 },
        brand: null,
      }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
      })
    }
    throw new Error(`Unexpected Supabase request: ${url}`)
  }

  const result = await getPublishedProducts({ locale: 'ru', searchParams: 'attr.ram_gb=16' })
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].slug, 'filtered-product')
  assert.ok(calls.some((call) => call.url.includes('/rpc/get_published_product_ids_by_attributes')))
  assert.ok(calls.every((call) => !call.url.includes('/product_attribute_values')))
})

test('F02 toPublicProductDTO masks numeric price amounts for price_mode request or hidden and excludes internal fields', () => {
  const rawRow = {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'request-product',
    sku: 'REQ-001',
    external_id: 'SECRET-VENDOR-ID-999',
    source_reference: 'private-vendor-feed.csv',
    source_hash: 'secret-hash-123456',
    source_type: 'csv',
    name_ru: 'Товар по запросу',
    name_kk: null,
    short_description_ru: 'Описание',
    short_description_kk: null,
    description_ru: null,
    description_kk: null,
    price_mode: 'request',
    price_amount: 99999, // Internal cost price that must never leak
    old_price_amount: 120000,
    currency: 'KZT',
    stock_status: 'in_stock',
    image_url: null,
    category: { slug: 'chairs' },
    brand: null,
  }

  const dto = toPublicProductDTO(rawRow, 'ru')
  assert.equal(dto.price.mode, 'request')
  assert.equal(dto.price.amount, null, 'Public DTO must mask price.amount to null when price_mode is request')
  assert.equal(dto.price.old_amount, null, 'Public DTO must mask price.old_amount to null when price_mode is request')
  assert.equal(dto.external_id, undefined, 'Public DTO must not contain external_id')
  assert.equal(dto.source_reference, undefined, 'Public DTO must not contain source_reference')
  assert.equal(dto.source_hash, undefined, 'Public DTO must not contain source_hash')
  assert.equal(dto.source_type, undefined, 'Public DTO must not contain source_type')
})

test('F05 toPublicProductDetailDTO formats typed specs for boolean, number, option, and text in RU and KK', () => {
  const row = {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'typed-product',
    sku: 'TYP-001',
    name_ru: 'Тестовый прибор',
    name_kk: 'Сынақ аспабы',
    price_mode: 'from',
    price_amount: 500,
    currency: 'KZT',
    stock_status: 'in_stock',
    category: { slug: 'devices' },
    product_images: [],
    product_attribute_values: [
      { value_boolean: true, attribute: { code: 'waterproof', name_ru: 'Влагозащита', name_kk: 'Сұйықтықтан қорғау', sort_order: 1 } },
      { value_boolean: false, attribute: { code: 'wireless', name_ru: 'Беспроводной', name_kk: 'Сымсыз', sort_order: 2 } },
      { value_number: 120.5, attribute: { code: 'weight_g', name_ru: 'Вес', name_kk: 'Салмағы', unit_ru: 'г', unit_kk: 'г', sort_order: 3 } },
      { value_option: 'USB-C', attribute: { code: 'port', name_ru: 'Разъем', name_kk: 'Порт', sort_order: 4 } },
      { value_text_ru: 'Черный', value_text_kk: 'Қара', attribute: { code: 'color', name_ru: 'Цвет', name_kk: 'Түсі', sort_order: 5 } },
    ],
  }

  const dtoRu = toPublicProductDetailDTO(row, 'ru')
  assert.deepEqual(dtoRu.specs, [
    { code: 'waterproof', name: 'Влагозащита', value: 'Да', unit: null },
    { code: 'wireless', name: 'Беспроводной', value: 'Нет', unit: null },
    { code: 'weight_g', name: 'Вес', value: '120.5', unit: 'г' },
    { code: 'port', name: 'Разъем', value: 'USB-C', unit: null },
    { code: 'color', name: 'Цвет', value: 'Черный', unit: null },
  ])

  const dtoKk = toPublicProductDetailDTO(row, 'kk')
  assert.deepEqual(dtoKk.specs, [
    { code: 'waterproof', name: 'Сұйықтықтан қорғау', value: 'Иә', unit: null },
    { code: 'wireless', name: 'Сымсыз', value: 'Жоқ', unit: null },
    { code: 'weight_g', name: 'Салмағы', value: '120.5', unit: 'г' },
    { code: 'port', name: 'Порт', value: 'USB-C', unit: null },
    { code: 'color', name: 'Түсі', value: 'Қара', unit: null },
  ])
})

test('switchLocalePath retains query string and slug for catalog, and strips invalid params for route', async () => {
  const { switchLocalePath } = await import('../lib/i18n/config.js')

  // Requirement: /ru/catalog?q=printer&page=2 -> /kk/catalog?q=printer&page=2
  assert.equal(
    switchLocalePath('/ru/catalog', 'kk', 'q=printer&page=2'),
    '/kk/catalog?q=printer&page=2'
  )

  // Category slug + catalog filters preserved
  assert.equal(
    switchLocalePath('/ru/catalog/printers', 'kk', 'q=laser&page=3&sort=price_asc'),
    '/kk/catalog/printers?q=laser&page=3&sort=price_asc'
  )

  // Invalid catalog parameters stripped
  assert.equal(
    switchLocalePath('/ru/catalog', 'kk', 'q=printer&page=2&unknown_filter=bad'),
    '/kk/catalog?q=printer&page=2'
  )

  // Non-catalog route strips catalog parameters
  assert.equal(
    switchLocalePath('/ru/about', 'kk', 'q=printer&page=2'),
    '/kk/about'
  )

  // Product route preserves slug and changes locale
  assert.equal(
    switchLocalePath('/ru/product/printer-hp-123', 'kk'),
    '/kk/product/printer-hp-123'
  )
})

test('getPublishedProductById handles invalid/missing UUIDs safely', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key'

  const { getPublishedProductById } = await import('../lib/catalog/repository.mjs')

  assert.equal(await getPublishedProductById({ locale: 'ru', id: null }), null)
  assert.equal(await getPublishedProductById({ locale: 'ru', id: '' }), null)
  assert.equal(await getPublishedProductById({ locale: 'ru', id: 'invalid-uuid-123' }), null)

  await assert.rejects(
    async () => getPublishedProductById({ locale: 'kk', id: '12345678-1234-4234-8234-1234567890ab' }),
    { name: 'CatalogRepositoryError' }
  )

  await assert.rejects(
    async () => getPublishedProductById({ locale: 'fr', id: '00000000-0000-4000-8000-000000000001' }),
    { name: 'CatalogQueryValidationError' }
  )
})


test('getPublishedProductById with mock RPC', async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key'
  const { getPublishedProductById } = await import('../lib/catalog/repository.mjs')

  const originalFetch = globalThis.fetch

  t.after(() => {
    globalThis.fetch = originalFetch
  })

  // 1. Successful RPC with record
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify([{ id: '00000000-0000-4000-8000-000000000001', slug: 'success-product' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  let res = await getPublishedProductById({ locale: 'ru', id: '00000000-0000-4000-8000-000000000001' })
  assert.deepEqual(res, { id: '00000000-0000-4000-8000-000000000001', slug: 'success-product' })

  // 2. Successful RPC without record (not found / unpublished)
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  res = await getPublishedProductById({ locale: 'ru', id: '00000000-0000-4000-8000-000000000002' })
  assert.equal(res, null)

  // 3. Error RPC (e.g. 500)
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify({ message: 'Internal Server Error', code: '500' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  await assert.rejects(
    async () => getPublishedProductById({ locale: 'ru', id: '00000000-0000-4000-8000-000000000003' }),
    { name: 'CatalogRepositoryError' }
  )

  // 4. PGRST202 (Schema not ready)
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify({ message: 'Could not find the function', code: 'PGRST202' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  await assert.rejects(
    async () => getPublishedProductById({ locale: 'ru', id: '00000000-0000-4000-8000-000000000004' }),
    { name: 'CatalogRepositoryError', message: 'CMS schema not ready', status: 503 }
  )

  // 5. Invalid UUID (no request should be made)
  let fetchCalled = false
  globalThis.fetch = async (url, options) => {
    fetchCalled = true
    return new Response(JSON.stringify([]), { status: 200 })
  }
  res = await getPublishedProductById({ locale: 'ru', id: 'not-a-uuid' })
  assert.equal(res, null)
  assert.equal(fetchCalled, false)

  // 6. Invalid locale
  await assert.rejects(
    async () => getPublishedProductById({ locale: 'en', id: '00000000-0000-4000-8000-000000000005' }),
    { name: 'CatalogQueryValidationError' }
  )
})
