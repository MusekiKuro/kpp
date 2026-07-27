import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildBackfillPlan,
  renderSeedSql,
  slugify,
} from '../scripts/backfill-legacy.mjs'

const fixture = JSON.parse(await readFile(new URL('../fixtures/legacy-products.json', import.meta.url), 'utf8'))

test('slugification is deterministic and safe for Cyrillic and punctuation', () => {
  assert.equal(slugify('Ноутбуки'), 'noutbuki')
  assert.equal(slugify('Office & Equipment'), 'office-equipment')
  assert.equal(slugify('!!!'), null)
})

test('backfill dry-run reports create/update/skip/error counts', () => {
  const plan = buildBackfillPlan(fixture)
  assert.deepEqual(plan.counts, { create: 4, update: 3, skip: 1, error: 1 })
  assert.equal(plan.categories.length, 2)
  assert.equal(new Set(plan.categories.map((category) => category.slug)).size, 2)
  assert.equal(plan.products[0].source_sku, '82H-001')
  assert.ok(plan.products[0].review_flags.includes('kz_translation_missing'))
  assert.ok(plan.products.some((product) => product.review_flags.includes('brand_mapping_missing')))
  assert.equal(plan.products.some((product) => product.name_kk !== null), false)
})

test('re-running the same fixture produces the same plan and idempotent SQL', () => {
  const first = buildBackfillPlan(fixture)
  const second = buildBackfillPlan(fixture)
  assert.deepEqual(second, first)

  const sql = renderSeedSql(first)
  assert.match(sql, /ON CONFLICT \(slug\) DO NOTHING/g)
  assert.match(sql, /COALESCE\(p\.slug/)
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/)
  assert.doesNotMatch(sql, /service_role|NEXT_PUBLIC/i)
})
