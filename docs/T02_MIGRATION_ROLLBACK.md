# T02 migration rollback and recovery note

This migration is additive and must be rehearsed on a staging Supabase project before production use. It must not be applied remotely by an agent.

## Before applying

- Create and verify a database backup.
- Record row counts and existing RLS policies for `products`, `orders`, and `storage.objects`.
- Apply the migration to a staging copy and run the anon, authenticated non-admin, and authenticated admin RLS matrix.
- Confirm that no production route depends on the new tables before rollout.

## Recovery

If validation or smoke tests fail, stop the rollout and restore the affected staging database from the verified backup or use the approved Supabase recovery procedure. Preserve migration history and record the failing statement and observed row counts.

Do not delete legacy `products`/`orders` tables or legacy columns as a rollback shortcut. The new tables are independent, but their foreign keys must be considered in this order if a human-approved staging rollback is necessary:

1. `quote_request_items`, then `quote_requests`;
2. `import_rows`, then `import_batches`;
3. `product_attribute_values`, then `attributes`;
4. `product_images`;
5. the additive columns and indexes on `products` only after confirming no dependent code or data remains.

Any destructive rollback requires an owner-approved backup, dependency check, and staging rehearsal. Production rollback is a human gate.
