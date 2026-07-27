#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { hashSource, normalizeRows, parseJson } from '../lib/import-staging.mjs'

function usage() {
  console.log('Usage: node scripts/import-dry-run.mjs --input <normalized.json> [--source-reference <name>]')
}

function args(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') { usage(); process.exit(0) }
    if (argument !== '--input' && argument !== '--source-reference') throw new Error(`Unknown option ${argument}`)
    const value = argv[index + 1]
    if (!value) throw new Error(`${argument} requires a value`)
    result[argument.slice(2).replace('-', '_')] = value
    index += 1
  }
  if (!result.input) throw new Error('--input is required')
  return result
}

try {
  const options = args(process.argv.slice(2))
  const buffer = await readFile(options.input)
  const rows = parseJson(buffer.toString('utf8'))
  const sourceHash = hashSource(buffer)
  const result = normalizeRows(rows, {
    sourceType: 'json',
    sourceReference: options.source_reference || options.input,
    sourceHash,
    existingProducts: [],
  })
  console.log(JSON.stringify({
    source: { type: 'json', reference: result.context.sourceReference, hash: sourceHash },
    summary: result.summary,
    rows: result.rows,
  }, null, 2))
  if (result.summary.error > 0) process.exitCode = 2
} catch (error) {
  console.error(`Dry-run failed: ${error.message}`)
  process.exitCode = 1
}
