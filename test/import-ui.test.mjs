import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { IMPORT_UI_FIELDS, mapImportRows, mappedFilename, parseImportText, suggestImportMapping } from '../lib/import-ui.mjs'

test('UI parser maps CSV aliases to canonical import fields', () => {
  const parsed = parseImportText('Артикул,Наименование,Цена\nSKU-1,"Стул",1000\n', 'source.csv')
  const mapping = suggestImportMapping(parsed.columns)
  const rows = mapImportRows(parsed.rows, mapping)
  assert.deepEqual(rows[0], { sku: 'SKU-1', name_ru: 'Стул', price_amount: 1000 })
  assert.ok(IMPORT_UI_FIELDS.includes('publish_kk'))
  assert.equal(mappedFilename('catalog-2026.csv'), 'catalog-2026.csv.mapped.json')
})

test('UI parser supports JSON rows, rejects duplicate mappings, and defers XLSX', () => {
  const parsed = parseImportText('{"rows":[{"sku":"SKU-1","name_ru":"Name"}]}', 'agent.json')
  assert.deepEqual(parsed.columns, ['sku', 'name_ru'])
  assert.throws(() => mapImportRows(parsed.rows, { sku: 'sku', name_ru: 'sku' }), /only once/)
  assert.throws(() => parseImportText('binary', 'source.xlsx'), /XLSX is a binary format/)
})

test('UI component exposes filter, typed confirmation, retry, and error download controls', async () => {
  const source = await readFile(new URL('../components/admin/ImportWorkflow.js', import.meta.url), 'utf8')
  assert.match(source, /Download all errors/)
  assert.match(source, /Type APPLY/)
  assert.match(source, /Retry apply/)
  assert.match(source, /\['all', 'create', 'update', 'skip', 'error'\]/)
})

test('normalized JSON dry-run exits cleanly for valid and invalid fixtures', () => {
  const script = fileURLToPath(new URL('../scripts/import-dry-run.mjs', import.meta.url))
  const valid = fileURLToPath(new URL('../fixtures/import/t10-valid.json', import.meta.url))
  const invalid = fileURLToPath(new URL('../fixtures/import/t10-invalid.json', import.meta.url))
  const validRun = spawnSync(process.execPath, [script, '--input', valid], { encoding: 'utf8', cwd: process.cwd() })
  assert.equal(validRun.status, 0, validRun.stderr)
  assert.match(validRun.stdout, /"create": 1/)
  const invalidRun = spawnSync(process.execPath, [script, '--input', invalid], { encoding: 'utf8', cwd: process.cwd() })
  assert.equal(invalidRun.status, 2, invalidRun.stderr)
  assert.match(invalidRun.stdout, /"error": 1/)
})
