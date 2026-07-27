# Nurset

Nurset is a localized RU/KZ corporate catalog for products, catalog requests,
and an authenticated admin CMS. The public application does not expose a
service-role Supabase credential.

## Current release status

The repository has passed the local static suite described below. It is not
release-ready until the human gates in [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
are completed, especially the open privileged-key incident, staging RLS
evidence, migration/backfill/import rehearsal, owner content, and production
hosting/rate-limit decisions.

## Local setup

Use Node.js and the versions resolved by `package-lock.json`. Create an ignored
`.env.local` with values supplied through the approved secret manager:

```text
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
NEXT_PUBLIC_SITE_URL=<canonical public origin, for example https://catalog.example>
```

`SUPABASE_SERVICE_ROLE_KEY` must never use a `NEXT_PUBLIC_*` name, be committed,
or be imported by a client component. `NEXT_PUBLIC_SITE_URL` must be the final
HTTPS origin before canonical URLs, hreflang, robots, or sitemap output are
verified.

Install and run the development server:

```powershell
npm.cmd install
npm.cmd run dev
```

Public routes are localized under `/ru` and `/kk`. Corporate pages are
`about`, `delivery-warranty`, and `contacts`; the privacy page is a noindex
content shell until the owner supplies approved legal text. Services and blog
routes are intentionally out of scope.

## Local verification

Run these commands from the repository root and retain their output with the
release evidence:

```powershell
npm.cmd run security:scan
npm.cmd run db:contract-check
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
npm.cmd run backfill:dry-run
npm.cmd run backfill:dry-run -- --format sql
npm.cmd run import:dry-run -- --input fixtures/import/t09-valid.json
npm.cmd run import:dry-run -- --input fixtures/import/t10-valid.json
npm.cmd run import:dry-run -- --input fixtures/import/t10-invalid.json
npm.cmd run import:dry-run -- --input fixtures/import/t09-malformed.csv
```

Invalid import fixtures are expected to exit non-zero and report reviewable
validation errors without applying rows. The dry-run and generated SQL do not
apply anything to Supabase.

`npm.cmd run storage:cleanup` is an operational worker, not a local verification
command. Run it only after the cleanup migrations have been applied and only in
an approved environment with the service-role secret supplied by its secret
store.

## Release procedure

Follow [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md). Database access,
credential rotation, remote history review, production migration, deployment,
and rollback are human-owned gates. This repository intentionally does not
provide an agent command for production SQL or deployment.

The dependency-ordered staging and import-automation phase is documented in
[docs/NEXT_PHASE_HANDOFF.md](docs/NEXT_PHASE_HANDOFF.md).
