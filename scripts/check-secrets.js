'use strict'

const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const sensitivePatterns = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]+\b/],
]

let trackedFiles
try {
  const output = execFileSync(
    'git',
    ['-c', `safe.directory=${repoRoot}`, '-C', repoRoot, 'ls-files', '-z'],
    { encoding: 'utf8' }
  )
  trackedFiles = output.split('\0').filter(Boolean)
} catch {
  console.error('Secret scan failed: unable to enumerate tracked files.')
  process.exit(1)
}

const findings = []
const skippedFiles = []

for (const relativePath of trackedFiles) {
  const filePath = path.join(repoRoot, relativePath)
  let contents

  if (!existsSync(filePath)) {
    skippedFiles.push(relativePath)
    continue
  }

  try {
    const buffer = readFileSync(filePath)
    if (buffer.includes(0)) continue
    contents = buffer.toString('utf8')
  } catch {
    console.error(`Secret scan failed: unable to read ${relativePath}.`)
    process.exit(1)
  }

  for (const [label, pattern] of sensitivePatterns) {
    if (pattern.test(contents)) {
      findings.push({ label, relativePath })
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found in tracked files:')
  for (const { label, relativePath } of findings) {
    console.error(`- ${relativePath} (${label})`)
  }
  console.error('Values are intentionally not printed.')
  process.exit(1)
}

console.log(`Secret scan passed: ${trackedFiles.length - skippedFiles.length} working-tree files checked; ${skippedFiles.length} deleted tracked files skipped.`)
