# Product import contract

This is the human-review contract for product imports in Nurset. The authoritative row schema is [schemas/import-product-row.schema.json](../schemas/import-product-row.schema.json). The agent document wrapper is [schemas/product-import-agent.schema.json](../schemas/product-import-agent.schema.json).

## Accepted documents

An agent produces UTF-8 JSON as either:

- an array of normalized product rows; or
- an object with exactly one property, `rows`, containing that array.

The admin UI also accepts CSV and XLSX. CSV column names are mapped in the browser; XLSX is inspected and parsed on the server, with explicit sheet selection and server-side mapping. Both paths send canonical data to the staging workflow, and the server validates the document again. The server remains authoritative.

The local XLSX implementation uses `exceljs` with bounded file/sheet/row/column/cell limits, ZIP/OOXML signature checks, and formula values treated as plain text. Local support does not replace the required staging dry-run, controlled `APPLY`, and owner approval of the production dependency and hosting configuration.

## Row rules

Each row uses the exact allowlist in the schema. Unknown keys are errors. Missing facts are represented as `null` where the schema allows it; they are never inferred from product names, neighboring rows, search results, or images.

Important fields:

- `sku` is the primary product identity when present. Do not invent one.
- `external_id` is matched only with the source type and source reference.
- `category_slug` is required for a new product. Do not create categories from an import.
- `price_mode` is one of `request`, `exact`, `from`, or `hidden`. Exact/from prices require a positive KZT amount.
- `stock_status` is one of `unknown`, `in_stock`, `on_order`, or `out_of_stock`.
- `name_ru` is required for a new product. `name_kk` can remain null.
- `publish_kk` is false unless the Kazakh translation is explicitly `verified`.
- `publication_status` and locale publish flags do not authorize publication. T09 apply never auto-publishes products; the UI requires review and typed `APPLY` confirmation.
- `source_hash` is computed from the uploaded bytes by the server. Agent-provided metadata is not trusted.

The pipeline reports `create`, `update`, `skip`, and `error` rows. Updates are matched only by SKU or source-scoped external ID. Preview diffs show before/after fields; omitted fields in a matched partial update are preserved by normalization.

## Safety boundary

The content agent must:

- never invent SKU, price, stock, warranty, brand, category, technical characteristics, or translation facts;
- use `null` and explain uncertainty in its own work log rather than adding unsupported JSON keys;
- never write directly to Supabase or call an admin API with a secret;
- never request, print, copy, or expose `SUPABASE_SERVICE_ROLE_KEY` or browser tokens;
- never scrape or hotlink unauthorized images. Use an approved source URL or `null`;
- never set a row up as an instruction to delete, archive, or publish another product;
- never treat an AI draft as a verified Kazakh translation.

The only write path is the authenticated admin UI: upload → map → stage → preview → approve → typed apply. A failed apply can be retried; completed batches are idempotent. No import automatically deletes products or publishes either locale.

## Local validation

Run the local dry-run without a database:

```text
npm.cmd run import:dry-run -- --input fixtures/import/t10-valid.json
npm.cmd run import:dry-run -- --input fixtures/import/t10-invalid.json
```

The first command exits zero and prints the source hash, normalized rows, and action summary. The invalid example exits with code `2` when row validation errors are found. Parse/input failures exit with code `1`.

## References

- [Normalized row schema](../schemas/import-product-row.schema.json)
- [Agent document schema](../schemas/product-import-agent.schema.json)
- [Valid example](../fixtures/import/t10-valid.json)
- [Invalid example](../fixtures/import/t10-invalid.json)
- [T09 backend API](../app/api/admin/imports/route.js)
- [XLSX preview API](../app/api/admin/imports/preview-xlsx/route.js)
- [XLSX parser ADR](./ADR_XLSX_PARSER.md)
