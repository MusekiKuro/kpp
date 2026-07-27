import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ADMIN_PRODUCT_DTO_FIELDS,
  CURRENCY,
  DomainValidationError,
  IMPORT_ACTIONS,
  IMPORT_BATCH_STATUSES,
  LOCALES,
  PRICE_MODES,
  PUBLIC_PRODUCT_DTO_FIELDS,
  PUBLICATION_STATUSES,
  SOURCE_TYPES,
  STOCK_STATUSES,
  TRANSLATION_STATUSES,
  validateAdminProductDTO,
  validateImportProductRow,
  validateLocale,
  validatePrice,
  validatePublicProductDTO,
  validateSku,
  validateSlug,
} from '../lib/domain-contracts.mjs'

const id = '11111111-1111-4111-8111-111111111111'

const validPrice = {
  mode: 'exact',
  amount: 1000,
  old_amount: 1200,
  currency: CURRENCY,
}

const validPublicProduct = {
  id,
  slug: 'office-laptop',
  sku: 'ABC-123',
  locale: 'ru',
  name: 'Office laptop',
  short_description: 'A short description',
  description: null,
  category_slug: 'laptops',
  brand_slug: null,
  price: validPrice,
  stock_status: 'in_stock',
  image_url: 'https://example.com/laptop.jpg',
}

const validAdminProduct = {
  id,
  slug: 'office-laptop',
  sku: 'ABC-123',
  external_id: null,
  category_slug: 'laptops',
  brand_slug: null,
  name_ru: 'Office laptop',
  name_kk: 'Кеңсе ноутбугі',
  short_description_ru: 'A short description',
  short_description_kk: null,
  description_ru: 'Description',
  description_kk: null,
  price: validPrice,
  stock_status: 'in_stock',
  publication_status: 'draft',
  publish_ru: false,
  publish_kk: false,
  translation_status_kk: 'verified',
  is_featured: false,
  source_type: 'json',
  source_reference: null,
  source_hash: null,
}

const validImportRow = {
  source_type: 'json',
  source_reference: 'fixture.json',
  source_hash: 'abc123',
  external_id: null,
  sku: 'ABC-123',
  slug: 'office-laptop',
  category_slug: 'laptops',
  brand_slug: null,
  name_ru: 'Office laptop',
  name_kk: 'Кеңсе ноутбугі',
  short_description_ru: 'A short description',
  short_description_kk: null,
  description_ru: 'Description',
  description_kk: null,
  price_mode: 'exact',
  price_amount: 1000,
  old_price_amount: 1200,
  currency: 'KZT',
  stock_status: 'in_stock',
  publication_status: 'draft',
  publish_ru: false,
  publish_kk: false,
  translation_status_kk: 'verified',
  is_featured: false,
  image_url: 'https://example.com/laptop.jpg',
}

test('domain enum contracts contain only the supported vocabulary', () => {
  assert.deepEqual(LOCALES, ['ru', 'kk'])
  assert.deepEqual(PRICE_MODES, ['request', 'exact', 'from', 'hidden'])
  assert.deepEqual(STOCK_STATUSES, ['unknown', 'in_stock', 'on_order', 'out_of_stock'])
  assert.deepEqual(PUBLICATION_STATUSES, ['draft', 'published', 'archived'])
  assert.deepEqual(TRANSLATION_STATUSES, ['missing', 'ai_draft', 'verified'])
  assert.deepEqual(SOURCE_TYPES, ['xlsx', 'csv', 'json', 'text_agent'])
  assert.deepEqual(IMPORT_ACTIONS, ['create', 'update', 'skip', 'error'])
  assert.deepEqual(IMPORT_BATCH_STATUSES, [
    'uploaded', 'parsed', 'needs_review', 'approved', 'applying', 'completed', 'failed', 'cancelled',
  ])
})

test('slug, SKU, and locale validators reject unsafe values', () => {
  assert.equal(validateSlug('office-laptop'), 'office-laptop')
  assert.equal(validateSku('ABC-123'), 'ABC-123')
  assert.equal(validateLocale('kk'), 'kk')
  assert.throws(() => validateSlug('Office Laptop'), DomainValidationError)
  assert.throws(() => validateSlug('office--laptop'), DomainValidationError)
  assert.throws(() => validateSku('ABC 123'), DomainValidationError)
  assert.throws(() => validateLocale('en'), DomainValidationError)
})

test('price validator enforces KZT, modes, positive amounts, and discount ordering', () => {
  assert.deepEqual(validatePrice(validPrice), validPrice)
  assert.deepEqual(validatePrice({ mode: 'request', amount: null, old_amount: null, currency: 'KZT' }), {
    mode: 'request', amount: null, old_amount: null, currency: 'KZT',
  })
  assert.throws(() => validatePrice({ ...validPrice, currency: 'USD' }), DomainValidationError)
  assert.throws(() => validatePrice({ ...validPrice, mode: 'from', amount: null }), DomainValidationError)
  assert.throws(() => validatePrice({ ...validPrice, old_amount: 1000 }), DomainValidationError)
  assert.throws(() => validatePrice({ ...validPrice, amount: -1 }), DomainValidationError)
})

test('public and admin DTOs reject unknown fields and private cross-boundary data', () => {
  assert.deepEqual(Object.keys(validatePublicProductDTO(validPublicProduct)).sort(), [...PUBLIC_PRODUCT_DTO_FIELDS].sort())
  assert.deepEqual(Object.keys(validateAdminProductDTO(validAdminProduct)).sort(), [...ADMIN_PRODUCT_DTO_FIELDS].sort())
  assert.throws(() => validatePublicProductDTO({ ...validPublicProduct, source_hash: 'private' }), DomainValidationError)
  assert.throws(() => validateAdminProductDTO({
    ...validAdminProduct,
    publish_kk: true,
    translation_status_kk: 'ai_draft',
  }), DomainValidationError)
})

test('import row validator is strict and preserves explicit nulls', () => {
  assert.deepEqual(validateImportProductRow(validImportRow), validImportRow)
  assert.throws(() => validateImportProductRow({ ...validImportRow, unexpected: true }), DomainValidationError)
  assert.throws(() => validateImportProductRow({ ...validImportRow, price_mode: 'from', price_amount: null }), DomainValidationError)
  assert.throws(() => validateImportProductRow({ ...validImportRow, publish_kk: true, translation_status_kk: 'ai_draft' }), DomainValidationError)
})


test('import JSON Schema is strict and includes price-mode conditions', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/import-product-row.schema.json', import.meta.url), 'utf8'))
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, [...new Set(schema.required)])
  assert.equal(schema.properties.currency.const, 'KZT')
  assert.deepEqual(schema.properties.price_mode.enum, ['request', 'exact', 'from', 'hidden'])
  assert.equal(schema.allOf.length, 4)
  assert.deepEqual(schema.properties.translation_status_kk.enum, ['missing', 'ai_draft', 'verified'])
})

// N06: adversarial fixture has dangerous values; forceDraft must sanitize them deterministically
test('N06 adversarial injection fixture has malicious values that forceDraft sanitizes to safe draft', async () => {
  const { normalizeRows } = await import('../lib/import-staging.mjs')
  const fixtureText = await readFile(new URL('../fixtures/import/t10-adversarial-injection.json', import.meta.url), 'utf8')
  const rawRows = JSON.parse(fixtureText)

  // Confirm fixture actually contains the dangerous values (fixture integrity check)
  assert.equal(rawRows[0].publication_status, 'published', 'Fixture must request published status to prove forceDraft is needed')
  assert.equal(rawRows[0].publish_ru, true, 'Fixture must request publish_ru=true to prove forceDraft is needed')
  assert.equal(rawRows[0].is_featured, true, 'Fixture must request is_featured=true to prove forceDraft is needed')

  const result = normalizeRows(rawRows, {
    sourceType: 'text_agent',
    sourceReference: 'adversarial-prompt-injection-test',
    sourceHash: 'a'.repeat(64),
    existingProducts: [],
  })

  const row = result.rows[0]
  const payload = row.normalized_payload

  // forceDraft must have forced publication_status to draft and publish_ru to false
  assert.equal(payload.publication_status, 'draft', 'forceDraft must override publication_status to draft')
  assert.equal(payload.publish_ru, false, 'forceDraft must override publish_ru to false')
  assert.equal(payload.publish_kk, false, 'publish_kk must remain false')

  // Verify a warning was emitted for the forced change
  assert.ok(
    row.validation_warnings.some((w) => /forced to draft/i.test(w)),
    'A warning must be emitted when publication fields are forced to draft',
  )
})

// N06: schema_version field in the agent schema envelope
test('N06 product-import-agent schema supports schema_version 1.1.0 envelope format', async () => {
  const agentSchema = JSON.parse(await readFile(new URL('../schemas/product-import-agent.schema.json', import.meta.url), 'utf8'))

  // Must have at least 3 oneOf variants: bare array, {rows}, and envelope
  assert.ok(Array.isArray(agentSchema.oneOf), 'Schema must use oneOf')
  assert.ok(agentSchema.oneOf.length >= 3, 'Schema must include at least 3 oneOf variants (array, rows object, and envelope)')

  // Find the envelope variant (has schema_version)
  const envelopeVariant = agentSchema.oneOf.find(
    (variant) => variant.properties?.schema_version,
  )
  assert.ok(envelopeVariant, 'Schema must include an envelope variant with schema_version property')
  assert.equal(envelopeVariant.properties.schema_version.const, '1.1.0', 'schema_version must be constrained to 1.1.0')

  // Envelope must require schema_version and records
  assert.ok(envelopeVariant.required?.includes('schema_version'), 'Envelope must require schema_version')
  assert.ok(envelopeVariant.required?.includes('records'), 'Envelope must require records')

  // Provenance and warnings arrays must be defined
  assert.ok(envelopeVariant.properties?.provenance, 'Envelope must define provenance property')
  assert.ok(envelopeVariant.properties?.warnings, 'Envelope must define warnings property')

  // Warnings must have stable codes
  const warningCodes = envelopeVariant.properties.warnings.items?.properties?.code?.enum
  assert.ok(Array.isArray(warningCodes), 'Warning code must be an enum')
  assert.ok(warningCodes.includes('missing_value'), 'Warning codes must include missing_value')
  assert.ok(warningCodes.includes('suspected_prompt_injection'), 'Warning codes must include suspected_prompt_injection')
  assert.ok(warningCodes.includes('normalization_coercion'), 'Warning codes must include normalization_coercion')
})

// N06: source_hash in import row is nullable (server-authoritative hashing)
test('N06 import row schema allows null source_hash for agent documents', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/import-product-row.schema.json', import.meta.url), 'utf8'))
  const sourceHashProp = schema.properties.source_hash
  assert.ok(
    Array.isArray(sourceHashProp.type) && sourceHashProp.type.includes('null'),
    'source_hash must allow null (server-authoritative hashing)',
  )
})
