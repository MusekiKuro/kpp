import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function checkDatabaseContracts() {
  const migrationsDir = new URL('../supabase/migrations', import.meta.url)
  const schemaFile = new URL('../supabase-schema.sql', import.meta.url)

  const migrationFiles = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  const sqlFiles = [
    ...migrationFiles.map((f) => ({ path: join(migrationsDir.pathname.replace(/^\/([a-zA-Z]:)/, '$1'), f), name: f })),
    { path: schemaFile.pathname.replace(/^\/([a-zA-Z]:)/, '$1'), name: 'supabase-schema.sql' },
  ]

  let errors = []

  // Check 1: Lightweight static contract rules across all SQL files.
  // This is not a PostgreSQL parser and does not replace applying the ordered
  // migration chain to a disposable or staging database.
  for (const file of sqlFiles) {
    const content = await readFile(file.path, 'utf8')

    // Check invalid AS $tag without trailing $
    const invalidAsTagMatch = content.match(/AS\s+\$([a-zA-Z0-9_]+)\b(?!\$)/g)
    if (invalidAsTagMatch) {
      errors.push(`[${file.name}] Contains invalid dollar quote syntax without closing dollar: ${invalidAsTagMatch.join(', ')}`)
    }

    // Check unclosed $tag$ or $$
    const tags = content.match(/\$([a-zA-Z0-9_]*)\$/g) || []
    const tagCounts = {}
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    }
    for (const [tag, count] of Object.entries(tagCounts)) {
      if (count % 2 !== 0) {
        errors.push(`[${file.name}] Unclosed dollar quote tag '${tag}' (count: ${count})`)
      }
    }

    // Check duplicate CREATE POLICY without preceding DROP POLICY IF EXISTS
    const lines = content.split('\n')
    const policyDrops = new Set()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const dropMatch = line.match(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']([^"']+)["']\s+ON\s+([a-zA-Z0-9_\.]+)/i)
      if (dropMatch) {
        policyDrops.add(`${dropMatch[1]} ON ${dropMatch[2]}`)
      }

      const createMatch = line.match(/CREATE\s+POLICY\s+["']([^"']+)["']\s+ON\s+([a-zA-Z0-9_\.]+)/i)
      if (createMatch) {
        const key = `${createMatch[1]} ON ${createMatch[2]}`
        if (!policyDrops.has(key)) {
          errors.push(`[${file.name}:${i + 1}] CREATE POLICY "${createMatch[1]}" ON ${createMatch[2]} missing preceding DROP POLICY IF EXISTS`)
        }
      }
    }

    // Check duplicate function definitions inside a single file
    const funcMatches = content.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)/gi) || []
    const funcCounts = {}
    for (const fm of funcMatches) {
      const name = fm.replace(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+/i, '').toLowerCase()
      funcCounts[name] = (funcCounts[name] || 0) + 1
    }
    for (const [name, count] of Object.entries(funcCounts)) {
      if (count > 1) {
        errors.push(`[${file.name}] Duplicate function definition for '${name}' within the same file (defined ${count} times)`)
      }
    }
  }

  // Check 2: supabase-schema.sql completeness
  const schemaContent = await readFile(schemaFile, 'utf8')

  const requiredTables = [
    'categories',
    'brands',
    'attributes',
    'products',
    'product_images',
    'product_attribute_values',
    'import_batches',
    'import_rows',
    'quote_requests',
    'quote_request_items',
    'orders',
    'storage_cleanup_queue',
  ]

  for (const table of requiredTables) {
    if (!schemaContent.includes(`CREATE TABLE IF NOT EXISTS public.${table}`) && !schemaContent.includes(`CREATE TABLE public.${table}`)) {
      errors.push(`[supabase-schema.sql] Missing required table 'public.${table}'`)
    }
  }

  const requiredRPCs = [
    'is_admin',
    'is_product_published',
    'get_published_product_slug',
    'get_published_product_detail',
    'get_published_product_ids_by_attributes',
    'save_cms_product_attributes',
    'ensure_product_primary_image_invariant',
    'set_primary_product_image',
    'create_product_image',
    'delete_product_image',
    'reorder_product_images',
    'apply_import_batch',
    'enqueue_storage_cleanup',
    'claim_storage_cleanup_jobs',
  ]

  for (const rpc of requiredRPCs) {
    if (!new RegExp(`FUNCTION\\s+public\\.${rpc}\\b`, 'i').test(schemaContent)) {
      errors.push(`[supabase-schema.sql] Missing required RPC 'public.${rpc}'`)
    }
  }

  // Check mandatory columns
  if (!/CREATE TABLE[^;]+public\.attributes[^;]+status\s+TEXT/is.test(schemaContent)) {
    errors.push(`[supabase-schema.sql] 'public.attributes' table missing 'status' column`)
  }

  if (!/CREATE TABLE[^;]+public\.product_images[^;]+updated_at\s+TIMESTAMPTZ/is.test(schemaContent)) {
    errors.push(`[supabase-schema.sql] 'public.product_images' table missing 'updated_at' column`)
  }

  if (!/CREATE TABLE[^;]+public\.storage_cleanup_queue[^;]+lease_token\s+UUID[^;]+lease_expires_at\s+TIMESTAMPTZ/is.test(schemaContent)) {
    errors.push(`[supabase-schema.sql] 'public.storage_cleanup_queue' table missing lease columns`)
  }

  if (!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_storage_cleanup_jobs\(INTEGER,\s*INTEGER\)\s+TO\s+service_role/i.test(schemaContent)) {
    errors.push('[supabase-schema.sql] cleanup claim RPC must be executable only by service_role')
  }

  const repositoryContent = await readFile(new URL('../lib/catalog/repository.mjs', import.meta.url), 'utf8')
  if (/\.from\(['"]product_attribute_values['"]\)/.test(repositoryContent)) {
    errors.push('[lib/catalog/repository.mjs] public catalog must not read product_attribute_values directly')
  }
  if (!/rpc\(['"]get_published_product_ids_by_attributes['"]/.test(repositoryContent)) {
    errors.push('[lib/catalog/repository.mjs] public attribute filters must use the restricted RPC')
  }

  const galleryRouteContent = await readFile(new URL('../app/api/admin/catalog/products/[id]/gallery/route.js', import.meta.url), 'utf8')
  if (!/is_primary:\s*body\.is_primary\s*===\s*true/.test(galleryRouteContent)) {
    errors.push('[gallery/route.js] create_product_image payload must include the requested primary flag')
  }

  const cleanupProcessorContent = await readFile(new URL('../lib/storage-cleanup-processor.mjs', import.meta.url), 'utf8')
  if (!/rpc\(['"]claim_storage_cleanup_jobs['"]/.test(cleanupProcessorContent) || !/\.eq\(['"]lease_token['"]/.test(cleanupProcessorContent)) {
    errors.push('[lib/storage-cleanup-processor.mjs] cleanup jobs must be claimed and finalized with a lease token')
  }

  if (errors.length > 0) {
    console.error('DB static contract check failed with', errors.length, 'errors:')
    for (const err of errors) {
      console.error(' -', err)
    }
    process.exit(1)
  }

  console.log('DB static contract check passed. Live migration execution is still required.')
}

checkDatabaseContracts().catch((err) => {
  console.error('DB contract check error:', err)
  process.exit(1)
})
