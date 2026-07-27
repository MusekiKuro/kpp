# Nurset release checklist

This checklist is an evidence record, not authorization for an agent to access
staging or production. Do not mark the release ready while any critical gate is
unchecked.

## 1. Owner content and configuration

- [ ] Owner supplies and approves the legal entity name, BIN, registered and
      operating address, responsible contact, and official contact channels.
- [ ] Owner supplies approved RU and KZ copy for delivery territory, timing,
      cost, handoff, warranty period, warranty exclusions, and claim process.
- [ ] Owner supplies the reviewed privacy policy, processing purposes, data
      categories, retention periods, legal bases, user rights, and contact for
      requests. The current privacy page is only a noindex shell.
- [ ] Owner confirms the default locale and reviews all RU/KZ translations.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin. Do not accept the
      localhost fallback for release metadata.
- [ ] Choose the production hosting and trusted edge rate-limit provider; make
      sure the trusted proxy supplies `x-forwarded-for`.
- [ ] Owner approves the local `exceljs` XLSX implementation and its bounded
      staging workflow; attach the staging dry-run and controlled `APPLY` evidence.
- [ ] Assign the content owner, incident reviewer, database operator, and
      rollback approver.

## 2. Security incident and secrets (human only)

- [ ] Rotate/revoke the exposed privileged Supabase key in Supabase.
- [ ] Store only the replacement as server-side `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Review remote Git history, branches, tags, pull requests, forks, CI/CD
      logs, deployment logs, Supabase logs, shell history, and release
      artifacts for the exposed key.
- [ ] Confirm the old key is rejected and the replacement is absent from
      tracked files and browser bundles.
- [ ] Record the project, rotation timestamp, reviewer, and observed activity
      in the approved incident system. Keep `docs/SECURITY_INCIDENT.md` open
      until these items are confirmed.

## 3. Staging migration, backfill, and rollback (human authorization required)

1. Verify the intended commit and a clean backup. Record row counts and current
   RLS policies for `products`, `orders`, and `storage.objects`.
2. Apply these migrations to a staging copy, in filename order, using the
   approved Supabase migration process:

   ```text
   supabase/migrations/20260722000000_harden_security_and_indexes.sql
   supabase/migrations/20260722010000_add_catalog_domain.sql
   supabase/migrations/20260723000000_add_quote_idempotency_consent.sql
   supabase/migrations/20260723010000_add_t08_cms_fields.sql
   supabase/migrations/20260723020000_add_import_apply_rpc.sql
   supabase/migrations/20260724000000_secure_catalog_boundary.sql
   supabase/migrations/20260724010000_disable_public_orders_insert.sql
   supabase/migrations/20260724020000_add_cms_atomic_update_and_triggers.sql
   supabase/migrations/20260724030000_add_gallery_atomic_and_primary_invariant.sql
   supabase/migrations/20260724040000_complete_catalog_runtime_contracts.sql
   ```

3. Review the local backfill plan and generated SQL:

   ```powershell
   npm.cmd run backfill:dry-run
   npm.cmd run backfill:dry-run -- --format sql
   ```

   A human database operator may apply reviewed SQL to staging only. Verify
   imported rows remain draft and record create/update/skip/error counts.
4. Rehearse the approved import staging and apply flow with valid, duplicate,
   retry, malformed, and invalid fixtures. Confirm a completed batch is
   idempotent and a failed batch records a safe failure summary.
5. Rehearse recovery from the verified staging backup. Preserve migration
   history; never delete legacy tables or use production as a rollback test.
6. Attach SQL output, row counts, migration status, apply result, and rollback
   result to the release evidence.

## 4. RLS and auth matrix (staging only)

Run this through real Supabase API sessions, not a privileged SQL editor
session. Use a disposable anonymous session, a disposable authenticated
non-admin user, and a disposable admin user. Do not use real customer data.

| Session | Expected public access | Expected private/admin access |
| --- | --- | --- |
| Anonymous | Published localized catalog through restricted views/RPCs, including safe gallery/spec details and attribute filters | Direct product/image/value tables, quote/import tables, and writes denied; admin APIs return 401 |
| Authenticated non-admin | Same published catalog access | `public.is_admin()` false; quote/import data denied; admin APIs return 403 |
| Authenticated admin | Published catalog plus authorized admin catalog access | Admin catalog, request list/status/note/CSV, import preview/approve/apply work; apply requires an approved batch |

Record the request, status, response, and evidence for every matrix cell:

- quote tables: SELECT/INSERT/UPDATE/DELETE;
- import batches and rows: SELECT/INSERT/UPDATE/DELETE;
- admin catalog endpoints and storage operations;
- `apply_import_batch` denied to non-admin and idempotent after completion;
- public quote submission derives product snapshots server-side and never
  accepts client product names/prices.
- public `attr.*` filters return only locale-valid published products and never
  expose draft products, raw attribute values, or base-table rows;
- two simultaneous cleanup workers cannot claim the same queue row; an expired
  lease is recoverable and completion requires the matching lease token.

## 5. RU/KZ and public smoke

- [ ] Check `/ru` and `/kk`, catalog and category pages, published product
      detail pages, request form, About, Delivery/Warranty, Contacts, and
      login/admin redirects in a browser.
- [ ] Confirm `<html lang>`, title, description, canonical, RU/KZ hreflang,
      x-default, and JSON-LD for each published route.
- [ ] Confirm sitemap contains only published catalog/corporate routes and
      excludes privacy, query variants, `/admin`, `/api/`, `/import/`, and
      `/request` from crawl targets as configured.
- [ ] Submit a quote with valid consent; repeat the same idempotency key;
      attempt tampered product data, duplicate items, rate-limit requests, and
      unnecessary PII. Confirm safe responses and no sensitive logs.
- [ ] Configure a server-only scheduled invocation of
      `npm.cmd run storage:cleanup`, force one retryable Storage failure, and
      confirm retry/backoff, terminal attempt count, and operational alerting.

## 6. Performance and accessibility

- [ ] Record a production-like report for home, catalog, and product detail
      with representative published data, including LCP/INP/CLS, JS weight,
      image weight, and API timings. No numeric budget is approved in the
      repository yet; the owner must set one before release.
- [ ] At desktop and 320px/375px mobile widths, complete a keyboard-only pass:
      skip link, menu open/close, Escape, Tab containment, visible focus,
      forms, validation/error announcements, request success state, admin
      editor dialog, and no horizontal overflow.
- [ ] Repeat with `prefers-reduced-motion: reduce` and verify no essential
      state is conveyed only through animation.
- [ ] Resolve the current CMS-editor dialog gap (role/label/focus trap/Escape/
      restore focus) in a dedicated narrow change before calling this gate
      passed.

## 7. Production rollout (human only)

1. Confirm sections 1–6 are complete, the incident is closed, and the release
   approver records the exact commit and backup ID.
2. Set production secrets in the approved secret manager. Never paste them in
   Git, issue trackers, terminal transcripts, client code, or this checklist.
3. Apply the reviewed migrations to production using the human-approved
   Supabase process. Do not run generated backfill SQL until its staging
   evidence and owner approval are attached.
4. Deploy through the approved hosting pipeline with the final HTTPS site URL,
   trusted rate limit, auth callback URLs, and storage configuration.
5. Run the post-deploy RU/KZ, catalog, quote, import, metadata, sitemap,
   robots, keyboard, and mobile smoke checks. Check logs for errors without
   logging request bodies or credentials.
6. Monitor the agreed window. If a gate fails, stop traffic or deployment as
   appropriate and restore from the verified backup/approved recovery process.
   Record the failing statement, row counts, timestamps, and approver.

## Current audit result

Local lint/test/build/diff and dry-run checks are recorded in the T12 report.
This checklist remains open because staging RLS and migration/rollback evidence,
production secret incident closure, production-like performance evidence,
interactive browser smoke, and owner-supplied content are not verified here.
