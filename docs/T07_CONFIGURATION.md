# T07 quote flow configuration

The public quote route writes to `quote_requests` and `quote_request_items` only through a server-side Supabase client. It requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose it to the browser or client bundle

The existing T02 quote tables/RLS migration must be applied to staging first. T07 additionally requires `supabase/migrations/20260723000000_add_quote_idempotency_consent.sql` for persistent `idempotency_key` uniqueness and `consent_at`.

The in-process idempotency guard still prevents immediate double-submit while a request is running. The database unique index is the durable race/restart protection after the additive migration is applied.

Rate limiting in the route is a bounded application fallback. Production should also configure a trusted edge/platform rate limit and ensure `x-forwarded-for` is supplied by that trusted proxy, not by an untrusted client.
