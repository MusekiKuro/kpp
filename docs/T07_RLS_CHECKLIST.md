# T07 quote request RLS checklist

This is a review checklist. It is not evidence that production SQL has been applied.

## Required policies

- [ ] `quote_requests` and `quote_request_items` have RLS enabled.
- [ ] Anonymous and ordinary authenticated users cannot `SELECT`, `INSERT`, `UPDATE`, or `DELETE` quote data.
- [ ] Admin access is gated by `public.is_admin()` and is limited to the admin server route.
- [ ] The public `POST /api/quote-requests` route uses the server-only service-role client; no public Supabase INSERT policy is added.
- [ ] The public route reloads products and writes only server-derived snapshots.
- [ ] `20260723000000_add_quote_idempotency_consent.sql` is applied in staging and its unique idempotency index is verified before production rollout.
- [ ] `20260724010000_disable_public_orders_insert.sql` drops legacy `"Public insert orders"` policy on `public.orders` and blocks direct `anon`/`authenticated` table `INSERT`.
- [ ] Legacy `POST /api/orders` routes requests safely through the server-validated quote-request workflow.

## Staging checks to execute

1. With the anon key, verify quote table reads and writes fail.
2. With a non-admin authenticated session, verify quote table reads and writes fail.
3. With an admin session, verify list, status/note update, and CSV export work.
4. Submit a request through the route and verify the header plus item snapshots are private and contain no client-supplied product name/price.
5. Submit the same idempotency key twice and verify exactly one quote header exists.

The repository can run static tests for the policy/migration contract, but it cannot replace these staging checks. Do not apply the additive migration to production from this task.
