# Nurset: backlog и промпты для ИИ-агента

Этот документ является исполняемым дополнением к [CORPORATE_CATALOG_SPEC.md](./CORPORATE_CATALOG_SPEC.md). Агент должен выполнять только одну карточку за один цикл, показывать результат и ждать подтверждения перед следующей.

## 1. Project handoff summary

### Цель

Расширить существующий Next.js 16 + Supabase проект до двуязычного корпоративного каталога RU/KZ без онлайн-оплаты. Цена по умолчанию — «По запросу». Администратор управляет товарами, локализациями и отдельными ценами. Массовое наполнение выполняется через безопасный staging-импорт Excel/CSV/JSON, а ИИ-агент готовит нормализованный JSON и никогда не пишет напрямую в production.

### Граница MVP

Входит: категории, бренды, локализованные товары, характеристики, галерея, поиск/фильтры/пагинация, запрос КП, CMS, импорт, SEO и QA. Не входит: оплата, личный кабинет, склад, 1С, услуги, блог, встроенный LLM API.

### Фиксированные технические решения

- существующий стек и App Router сохраняются;
- публичные locale prefixes: `/ru`, `/kk`; `/` перенаправляется на `/ru`;
- `/admin` остаётся вне locale routing;
- admin role только из `app_metadata.role`;
- миграции additive-first, без удаления legacy-полей в первой версии;
- новый товар по умолчанию draft + `price_mode=request`;
- RU требуется для RU publish; KZ имеет отдельный publish/status;
- импорт: parse -> normalize -> validate -> staging -> preview -> human approval -> apply;
- никакого commit/push/deploy/production migration без прямого разрешения.

### Предположения

- валюта KZT;
- RU — default locale;
- до выбора аналитики используется vendor-neutral adapter;
- XLSX-библиотека выбирается отдельно после проверки, поскольку сейчас её нет в dependencies;
- юридические тексты и фактические условия поставляет владелец.

### Критические риски

- текущий working tree содержит незакоммиченные security-изменения;
- tracked `list_products.js` и `update_images.js` содержат privileged Supabase key; ключ необходимо считать скомпрометированным и ротировать вручную;
- миграция данных может затронуть существующий каталог;
- AI-переводы и импортированные характеристики требуют human review;
- public quote requests содержат персональные данные;
- локальный in-memory rate limit недостаточен для distributed production.

### Блокирующие human gates

1. Ротация privileged Supabase key.
2. Review/checkpoint текущего security baseline.
3. Backup и staging rehearsal перед каждой production migration.
4. Одобрение production XLSX dependency.
5. Юридические тексты и реквизиты до публикации соответствующих страниц.

## 2. Task map

| ID | Задача | Зависит от | Scope | Риск | Сигнал завершения |
|---|---|---|---|---|---|
| T00 | Security incident и baseline | — | секреты, текущий diff, test harness | Critical | ключ удалён из файлов, ротация отмечена human gate, baseline checks проходят |
| T01 | Доменные контракты и validators | T00 | locale, price, publication, import schemas | Medium | контракты и unit tests приняты |
| T02 | Additive database migration | T01 | категории, бренды, products expansion, images, attributes, imports, quote requests, RLS | Critical | migration review + staging-ready SQL |
| T03 | Backfill и совместимость legacy | T02 | данные, slugs, categories/brands, seed | High | dry-run отчёт без потерь и дублей |
| T04 | I18n routing foundation | T01 | `/ru`, `/kk`, dictionaries, switcher | High | locale smoke tests и build проходят |
| T05 | Catalog query layer | T02,T03,T04 | published queries, filters, pagination, cache | High | URL-driven catalog API/data tests проходят |
| T06 | Public catalog UI | T05 | home, catalog, category, brand, product | Medium | RU/KZ responsive pages работают |
| T07 | Quote request flow | T02,T04,T06 | request list, form, secure API, admin requests | High | validated request end-to-end проходит |
| T08 | Admin catalog CMS | T02,T03,T04 | products, categories, brands, attributes, images, prices, publishing | High | admin CRUD/preview/publish smoke проходит |
| T09 | Import staging backend | T01,T02,T08 | JSON/CSV/XLSX ingest, validation, preview/apply | Critical | idempotent dry-run/apply tests проходят |
| T10 | Import UI и AI contract | T09 | mapping UI, reports, agent prompt/schema/examples | High | Excel/text-to-preview workflow работает |
| T11 | Corporate pages и SEO | T04,T05,T06 | about, delivery, contacts, privacy shell, metadata, sitemap | Medium | SEO/a11y checks проходят без выдуманного контента |
| T12 | Hardening и release rehearsal | T07,T08,T10,T11 | tests, RLS, performance, rollback, docs | Critical | полный release checklist подтверждён |

Основная цепочка:

```text
T00 -> T01 -> T02 -> T03 -> T05 -> T06 -> T07 -> T12
                  -> T08 -> T09 -> T10 -> T12
       T01 -> T04 -> T05
                  -> T11 -> T12
```

Не выполнять параллельно:

- T02 и T03: общий schema/data contract;
- T05 и T08: общий product API/data layer;
- T09 и T10: общий import contract;
- любые production migrations и feature edits.

## 3. OpenCode task cards

### T00 — Security incident и проверяемый baseline

**Назначение:** устранить hardcoded privileged key, зафиксировать текущее состояние и добавить минимальный test command без feature-изменений.

**Не входит:** ротация ключа в Supabase, очистка remote history, новые функции каталога, commit/push.

**Проверить:** `AGENTS.md`, `package.json`, `.gitignore`, текущий `git diff`, `list_products.js`, `update_images.js`, auth/RLS changes.

**Acceptance criteria:**

- privileged key отсутствует во всех tracked-файлах;
- скрипты используют server-only env name и завершаются понятной ошибкой при отсутствии env;
- `.env.example`, если создаётся, содержит только имена переменных;
- добавлен безопасный secret-scan command/script без печати значений;
- добавлен `npm.cmd run test` на встроенном `node:test` либо документирован reason, почему это блокирует задачу;
- текущие lint/build продолжают проходить;
- создан `docs/SECURITY_INCIDENT.md` без секрета с human checklist ротации/history/log review;
- агент сообщает, что ключ всё ещё считается действующим до подтверждения ротации человеком.

**Verification:**

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
git status --short
```

**Paste-ready prompt:**

```text
You are implementing only task T00: Security incident and verifiable baseline in D:\KP\nurset-app.

First inspect AGENTS.md, the repository, current uncommitted diff, package scripts, list_products.js, update_images.js, auth helpers, schema, and migrations. If required facts are missing or the task conflicts with existing code, stop and explain the blocker; do not guess.

Make the smallest coherent change that satisfies the acceptance criteria. Do not implement later catalog features, redesign unrelated code, add dependencies without need, or modify real secrets and deployment configuration.

Treat every privileged Supabase key hardcoded in tracked files as compromised. Remove the value without printing or copying it, make scripts read a server-only environment variable, add a safe missing-env failure, and create a secret-free incident checklist. Do not rotate credentials, rewrite git history, commit, push, or deploy; these are human gates. Establish a minimal npm test command using Node's built-in test runner unless the repository proves that impossible.

Acceptance: no tracked source contains the credential; lint, test, build, git diff --check pass; SECURITY_INCIDENT.md clearly requires key rotation and remote-history/log review. Run the specified checks. Report changed files, what was implemented, commands and results, and remaining risks. Do not commit or push unless explicitly asked.
```

### T01 — Доменные контракты и validators

**Назначение:** определить единые pure-JS контракты до изменения БД/UI.

**Не входит:** SQL migration, locale pages, admin UI.

**Проверить:** существующие `lib/request-validation.js`, product/order APIs, spec.

**Acceptance criteria:**

- constants/enums для locales, price modes, stock, publication, translation и import statuses;
- slug/SKU/price/localized payload validators;
- JSON Schema для import product row;
- DTO разделены на public/admin/import;
- validation не принимает unknown fields;
- pure unit tests покрывают edge cases;
- legacy payload compatibility явно ограничена.

**Verification:** `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`.

**Paste-ready prompt:**

```text
You are implementing only task T01: Domain contracts and validators in D:\KP\nurset-app.

First inspect AGENTS.md, docs/CORPORATE_CATALOG_SPEC.md, existing request validation, product/order routes, schema and package scripts. If required facts are missing or the task conflicts with existing code, stop and explain the blocker; do not guess.

Make the smallest coherent change that satisfies this task. Do not implement migrations, pages, admin UI, imports execution, later tasks, or add dependencies without need. Define pure reusable contracts for ru/kk locales, request/exact/from/hidden pricing, KZT, stock/publication/translation/import statuses, localized product DTOs, SKU/slug and price consistency. Add a strict import-row JSON Schema and Node built-in unit tests. Keep temporary legacy payload support explicit and narrow.

Run npm.cmd run test, npm.cmd run lint and npm.cmd run build. Report changed files, implementation, command results, assumptions and remaining risks. Do not commit or push unless explicitly asked.
```

### T02 — Additive database migration и RLS

**Назначение:** создать целевую схему без разрушения legacy-данных.

**Не входит:** применение migration в production, backfill данных, UI.

**Проверить:** текущие schema/migration, RLS, auth role, T01 contracts.

**Acceptance criteria:**

- migration создаёт categories, brands, product_images, attributes/value tables, import tables, quote request tables;
- products получает новые nullable/additive поля;
- constraints и indexes соответствуют spec;
- timestamps обновляются безопасно;
- RLS: public только published catalog read; non-admin не пишет; import/request/private data admin-only;
- public quote submission не получает прямой table insert;
- migration не удаляет legacy columns/tables;
- documented rollback/recovery plan;
- SQL пригоден для staging review и не выполняется агентом удалённо.

**Verification:** статическая проверка SQL, `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`. Database execution — human gate.

**Paste-ready prompt:**

```text
You are implementing only task T02: Additive database migration and RLS in D:\KP\nurset-app.

First inspect AGENTS.md, docs/CORPORATE_CATALOG_SPEC.md, T01 contracts, current supabase-schema.sql, all supabase/migrations, auth helpers and current RLS. Read relevant installed Next.js documentation before touching Next-specific code, though this task should primarily be SQL. If facts conflict, stop and explain; do not guess.

Create an additive, reviewable Supabase migration for categories, brands, expanded products, galleries, structured attributes, import staging and quote requests. Preserve all legacy tables/columns and data. Enforce admin writes with app_metadata-based RLS. Do not allow anon direct inserts into private quote/import tables. Add constraints and indexes without inventing business data. Include a rollback/recovery note. Do not apply SQL to any remote project and do not use service credentials.

Run local static checks, npm.cmd run test, npm.cmd run lint, npm.cmd run build and git diff --check. Report files, schema decisions, commands/results, manual database checks required and risks. Do not commit or push.
```

### T03 — Legacy backfill, seed и совместимость

**Назначение:** безопасно преобразовать существующий каталог в новую модель.

**Не входит:** удаление legacy columns, выдумывание SKU/KZ/брендов, production apply.

**Проверить:** existing products/seed format, T02 migration, sample Excel only read-only.

**Acceptance criteria:**

- deterministic backfill RU fields и slugs;
- categories создаются из legacy category без дублей;
- brand назначается только при надёжном mapping, иначе null/review;
- SKU не выдумывается; missing SKU получает review flag;
- seed обновлён под новую модель и идемпотентен;
- есть dry-run/report script без remote writes;
- старые product UUID URLs получают mapping/redirect plan;
- повторный backfill не создаёт дубли;
- rollback/recovery описан.

**Verification:** local dry-run на fixture/copy, tests, lint, build, diff check. Production DB — human gate.

**Paste-ready prompt:**

```text
You are implementing only task T03: Legacy backfill, seed and compatibility in D:\KP\nurset-app.

Inspect AGENTS.md, both specification documents, T02 migration, seed-products.sql, current product code, existing data helper scripts and the sample price list read-only. If exact source data is unavailable, use fixtures and stop before claiming production readiness.

Implement deterministic, idempotent local backfill/seed tooling. Populate RU fields and safe unique slugs from existing data, derive categories without duplicates, assign brands only from explicit mappings, never invent SKU or KZ translation, and mark incomplete products for review. Preserve legacy fields and UUID compatibility. Do not connect to or modify remote Supabase. Do not implement public/admin UI.

Run dry-run fixtures, npm.cmd run test, lint, build and git diff --check. Report counts for create/update/skip/error, files changed, results and staging steps. Do not commit or push.
```

### T04 — I18n routing foundation

**Назначение:** ввести RU/KZ routing и локализованные UI dictionaries.

**Не входит:** полный редизайн каталога, content translation, admin localization.

**Проверить:** installed Next 16 docs for dynamic routes, proxy, metadata; current app layout/header/footer/auth proxy.

**Acceptance criteria:**

- `/` -> `/ru`;
- only `ru`/`kk` accepted;
- public pages under `app/[locale]` or equivalent supported design;
- `/admin` auth routing не сломан;
- document `lang`, dictionary loading и locale switcher корректны;
- switcher сохраняет entity slug/query where possible;
- no duplicate header/footer/cart providers;
- RU/KZ UI strings centralized;
- invalid locale -> 404;
- tests for locale helpers/routing where practical.

**Verification:** test, lint, build, manual routes `/`, `/ru`, `/kk`, `/admin/login`.

**Paste-ready prompt:**

```text
You are implementing only task T04: I18n routing foundation in D:\KP\nurset-app.

First inspect AGENTS.md, docs/CORPORATE_CATALOG_SPEC.md, installed Next.js 16 documentation for layouts, dynamic routes, metadata and proxy, plus current app layout/header/footer/cart/admin proxy. Stop if the installed docs contradict the proposed routing; explain before editing.

Implement only the ru/kk routing foundation: root redirect to /ru, validated locale segment, centralized dictionaries, correct html lang, locale-aware links/switcher, and preservation of /admin outside localization. Move/reuse public components carefully without duplicating providers or breaking existing pages. Use existing design and do not implement the new catalog data model or corporate content yet.

Run npm.cmd run test, lint and build, then smoke /, /ru, /kk and /admin/login. Report changed files, route behavior, checks and risks. Do not commit or push.
```

### T05 — Catalog query layer, filters и cache

**Назначение:** создать серверный read layer для опубликованного каталога.

**Не входит:** финальный UI, admin CRUD, imports.

**Проверить:** T02/T03 schema, current ProductGrid and public API, Next data/cache docs.

**Acceptance criteria:**

- public DTO excludes draft/admin/import fields;
- queries filter locale publication;
- server pagination default 24 and enforced max;
- validated category/brand/stock/price/attribute filters;
- search current locale + SKU + brand;
- deterministic sorting;
- URL query parser unit-tested;
- select field lists, not `select('*')`;
- tag-based invalidation contract for future admin mutations;
- query failures produce safe errors.

**Verification:** unit tests/fixtures, lint, build, representative URL parser tests.

**Paste-ready prompt:**

```text
You are implementing only task T05: Catalog query layer, filters, pagination and cache in D:\KP\nurset-app.

Inspect AGENTS.md, the full spec, T02/T03 schema work, T04 locale helpers, current ProductGrid/public product API and installed Next.js data caching docs. If database fields are not yet available, stop; do not fake the contract.

Create a server-side catalog repository/query layer for published localized products, categories and brands. Add strict URL filter parsing, server pagination (24 default with a bounded max), safe search, deterministic sorting, explicit select lists, public DTOs and cache tags. Do not build final pages or admin CRUD. Do not expose draft, import or private fields.

Run tests, lint and build. Report changed files, supported query parameters, checks/results, index assumptions and remaining risks. Do not commit or push.
```

### T06 — Публичный каталог и страницы товара

**Назначение:** реализовать полноценный RU/KZ public experience на query layer.

**Не входит:** quote submission backend, admin CMS, imports, services/blog.

**Проверить:** existing visual system/components, T04/T05, accessibility.

**Acceptance criteria:**

- locale home with categories and featured products;
- `/catalog`, category and brand pages;
- server-driven search/filter/sort/pagination;
- product page by slug with gallery, price modes, stock, specs, related products;
- request-list button stores IDs/qty only;
- loading/empty/error/404 states;
- responsive and keyboard accessible;
- no unverified corporate claims;
- old UUID product links have safe redirect/compatibility.

**Verification:** tests, lint, build, manual desktop/mobile routes RU/KZ.

**Paste-ready prompt:**

```text
You are implementing only task T06: Public bilingual catalog UI in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff docs, current components/styles, T04 locale foundation and T05 catalog query layer. Preserve the established visual identity unless accessibility or responsive behavior requires a focused change.

Implement localized home catalog blocks, catalog/category/brand pages and product-by-slug pages with server-driven filters, sorting and pagination. Support request/exact/from/hidden price display, structured specs, galleries, related products, loading/empty/error/404 states and legacy UUID redirect compatibility. The request list stores only product IDs and quantities. Do not implement submission backend, admin CMS, imports, services or blog.

Run tests, lint, build and manual RU/KZ desktop/mobile smoke checks. Report files, routes, results and remaining content gaps. Do not commit or push.
```

### T07 — Запрос коммерческого предложения end-to-end

**Назначение:** заменить ecommerce semantics на безопасный quote request flow.

**Не входит:** payment, invoices, customer account, CRM integration.

**Проверить:** current cart/order API/admin orders, T02 quote schema, auth/RLS, consent requirements.

**Acceptance criteria:**

- UI называется запросом/КП, не покупкой;
- form fields and localized validation per spec;
- server trusts only product ID/qty and enriches snapshot;
- public table direct insert revoked; server-only submission secret never reaches client;
- idempotency/double-submit protection;
- body/rate limits and platform-rate-limit note;
- consent timestamp, locale, source, UTM stored;
- admin request list/status/notes and safe CSV;
- old orders compatibility/migration path preserved;
- PII not logged unnecessarily.

**Verification:** unit/API tests with valid/invalid/tampered payloads, RLS checklist, lint, build, manual flow.

**Paste-ready prompt:**

```text
You are implementing only task T07: Quote request flow end-to-end in D:\KP\nurset-app.

Inspect AGENTS.md, the full spec, T02 quote request schema/RLS, current cart, order routes and admin orders UI, plus auth/server-client helpers. If a required server-only credential is absent, implement the safe code path and env-name documentation but do not add a real value or weaken RLS.

Replace public purchase wording with request-for-quote semantics. Implement localized request list/form, strict server validation and product snapshot enrichment, consent/locale/source/UTM capture, duplicate-submit protection, safe rate/body limits, private quote storage, admin status/notes and formula-safe CSV. Preserve a compatibility path for old orders. Do not add payment, invoices, CRM or customer accounts.

Run tests for tampering and validation, lint, build, RLS checklist and manual request smoke. Report files, commands/results, required platform configuration and risks. Do not commit, push, migrate production or expose secrets.
```

### T08 — Admin catalog CMS

**Назначение:** расширить админку до управления новой моделью.

**Не входит:** import parser/apply, public redesign, role management.

**Проверить:** current admin auth/layout/products, T02/T03/T04 contracts, API security.

**Acceptance criteria:**

- products list server-paginated with quality filters;
- product editor RU/KZ tabs, SKU, slug, brand/category, price, stock, publication, SEO;
- gallery multi-image upload/order/primary/delete;
- structured attributes;
- RU/KZ preview and separate publish controls;
- categories tree CRUD with cycle protection;
- brands CRUD;
- archive default instead of destructive delete;
- all API operations admin + RLS protected;
- revalidation after publish/update;
- errors never corrupt UI state.

**Verification:** unit/API tests, lint, build, manual admin CRUD with admin/non-admin checks.

**Paste-ready prompt:**

```text
You are implementing only task T08: Admin catalog CMS in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff docs, current SSR admin auth/layout/products, T02 schema, T03 compatibility and T04 locale contracts. Read installed Next.js docs relevant to any server/client boundary you change. Stop if migrations or APIs required by this task are missing.

Implement the CMS for products, categories, brands, attributes and galleries. Add server pagination, quality filters, RU/KZ editor tabs, SKU/slug, price modes, stock, SEO, separate locale publication, preview, archive behavior, category cycle protection and cache revalidation. Preserve admin authorization in routes and RLS. Do not implement import ingestion/apply or change roles.

Run tests, lint, build and manual admin/non-admin CRUD smoke. Report changed files, behavior, commands/results and remaining risks. Do not commit or push.
```

### T09 — Import staging backend

**Назначение:** создать безопасную server-side import pipeline.

**Не входит:** final mapping UI, LLM API, direct production automation.

**Проверить:** T01 import schema, T02 import tables, T08 admin APIs, old parse scripts only as cautionary examples.

**Acceptance criteria:**

- JSON and CSV ingestion supported;
- XLSX parser dependency is `Confirm first` before install;
- file/body/row/cell limits;
- formula/macro/external-link considerations documented;
- hash detects duplicate source;
- normalization/validation creates import_rows;
- SKU/external source matching only;
- preview diff create/update/skip/error;
- explicit admin approval;
- transactional/idempotent apply;
- no automatic deletes/publish;
- audit summary and retry-safe failure state;
- no direct client/service-key exposure.

**Verification:** fixture tests duplicate/malformed/partial/update, lint, build, admin auth tests.

**Paste-ready prompt:**

```text
You are implementing only task T09: Import staging backend in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff docs, T01 import JSON Schema, T02 import tables/RLS, T08 admin APIs and old ad-hoc parsing scripts. Treat every import as untrusted. There is no approved XLSX dependency: before adding one, stop and present the exact package, license, runtime and security tradeoff for approval. JSON and CSV can proceed without that decision.

Implement admin-only upload/normalize/validate/stage/preview/approve/apply APIs. Add strict limits, source hashing, SKU/source-scoped external ID matching, field diffs, transactional idempotent apply, audit summaries and safe failure/retry states. Never auto-delete or auto-publish products and never expose service credentials.

Run fixture tests for duplicates, malformed rows, partial updates and retries, then lint and build. Report files, API contracts, results, the XLSX decision gate and risks. Do not commit, push or touch production.
```

### T10 — Import UI, XLSX после approval и AI-agent contract

**Назначение:** завершить human-in-the-loop import experience и дать отдельный промпт агенту наполнения.

**Не входит:** встроенный LLM API, unattended apply, web scraping без разрешения.

**Проверить:** T09 APIs, approved XLSX decision, sample Excel read-only, admin design.

**Acceptance criteria:**

- upload JSON/CSV and XLSX only if dependency approved;
- column mapping, preview, summary, filters, row errors/warnings/diff;
- explicit typed confirmation before apply;
- progress/final report/history/retry;
- downloadable error report;
- CLI dry-run for agent-produced JSON;
- `docs/PRODUCT_IMPORT_CONTRACT.md`;
- `docs/PRODUCT_IMPORT_AGENT_PROMPT.md`;
- valid/invalid example payloads;
- agent prompt forbids invented facts, direct DB writes and auto-publish.

**Verification:** fixture import UI/CLI, test, lint, build, manual duplicate-file flow.

**Paste-ready prompt:**

```text
You are implementing only task T10: Import UI and AI-agent import contract in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff docs, T09 backend, current admin design and the sample Excel only as read-only input. Confirm that an XLSX package has been explicitly approved before installing or using it; otherwise finish JSON/CSV and document the remaining gate.

Build the admin import workflow: upload, column mapping, preview, create/update/skip/error filters, field diff, explicit confirmation, progress, result history, retry and error-report download. Add a local dry-run command for normalized JSON. Create PRODUCT_IMPORT_CONTRACT.md, PRODUCT_IMPORT_AGENT_PROMPT.md, JSON Schema references and valid/invalid examples. The content agent must never invent missing facts, write directly to Supabase, expose secrets, scrape unauthorized images or auto-publish.

Run fixture UI/CLI tests, npm.cmd run test, lint and build, then a manual duplicate-source flow. Report files, commands/results, approved/deferred XLSX behavior and risks. Do not commit or push.
```

### T11 — Corporate pages, SEO и accessibility

**Назначение:** завершить структуру полноценного корпоративного сайта без выдумывания контента.

**Не входит:** услуги, блог, legal advice, analytics vendor installation.

**Проверить:** existing About/Contacts, T04/T05/T06, metadata and sitemap docs.

**Acceptance criteria:**

- RU/KZ pages About, Delivery/Warranty, Contacts, Privacy shell;
- unconfirmed legal/factual content clearly marked draft/admin-controlled;
- localized metadata, canonical, hreflang;
- sitemap published locales only;
- robots blocks admin/import/private endpoints;
- breadcrumb/Product/Organization JSON-LD only with known facts;
- accessible navigation/forms/dialogs/focus/reduced motion;
- vendor-neutral analytics adapter/events without PII leakage;
- no Services link/page.

**Verification:** tests, lint, build, metadata/sitemap inspection, keyboard/mobile smoke.

**Paste-ready prompt:**

```text
You are implementing only task T11: Corporate pages, SEO and accessibility in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff docs, current About/Contacts components, T04 locale routing, T05 data layer, T06 public pages and installed Next.js metadata/sitemap docs. Do not invent legal entity details, delivery promises, branch counts, warranties or privacy claims. Mark missing owner-supplied content as draft/configuration gaps.

Implement localized About, Delivery and Warranty, Contacts and privacy shell pages; metadata, canonical, hreflang, published-only sitemap, robots exclusions and accurate structured data. Improve keyboard/focus/dialog/form/reduced-motion behavior in touched flows. Add a vendor-neutral analytics event adapter without selecting a provider or sending PII. Do not add Services or blog.

Run tests, lint, build, inspect metadata/sitemap and perform keyboard/mobile smoke checks. Report files, results and content still required from the owner. Do not commit or push.
```

### T12 — Hardening, migration rehearsal и release readiness

**Назначение:** независимо проверить результат и подготовить безопасный rollout.

**Не входит:** production migration/deploy, commit/push, исправление новых крупных проблем без отдельного плана.

**Проверить:** весь diff, tests, RLS, migrations, performance, accessibility, security incident status.

**Acceptance criteria:**

- full lint/test/build/diff checks pass;
- no tracked secret or client-bundled server env;
- staging migration/backfill/apply/rollback rehearsal documented;
- RLS matrix tested for anon/non-admin/admin;
- RU/KZ/publication/sitemap smoke complete;
- quote request tamper/duplicate/rate/PII cases covered;
- import malformed/duplicate/retry/idempotency cases covered;
- performance budget/report for home/catalog/product;
- accessibility keyboard/mobile pass;
- README setup/migration/import/release updated;
- explicit list of human production steps and remaining risks.

**Verification:** all repository commands plus staging-only database/browser tests after approval.

**Paste-ready prompt:**

```text
You are implementing only task T12: Hardening and release readiness audit in D:\KP\nurset-app.

Inspect AGENTS.md, both handoff documents, the complete current diff, package scripts, migrations, RLS, auth, public/admin flows, imports and security incident checklist. This is primarily an audit task. Do not make broad repairs immediately: classify findings, propose the smallest repair plan, and only make narrow fixes that are unquestionably within completed acceptance criteria.

Run the complete lint/test/build/diff suite, safe secret scan, RLS role matrix in staging only when authorized, migration/backfill/rollback rehearsal, RU/KZ/catalog/request/import smoke checks, performance and keyboard/mobile accessibility checks. Update README/release checklist with exact human-only production steps. Never rotate credentials, rewrite git history, apply production SQL, deploy, commit or push.

Report findings by priority, changed files if any, every command and result, blocked checks, production gates and residual risks. Do not declare release-ready if any critical gate is unverified.
```

## 4. Control prompts

### Start next task

```text
Read D:\KP\nurset-app\docs\CORPORATE_CATALOG_SPEC.md and D:\KP\nurset-app\docs\IMPLEMENTATION_BACKLOG_AND_PROMPTS.md. Inspect git status and the previous task report. Select the first task whose dependencies are complete, then execute only that task using its exact task-card prompt. Do not start a second task. Stop for any human gate or conflicting repository state. Report changed files, commands/results and remaining risks. Do not commit or push.
```

### Review completed task

```text
Review the most recently completed Nurset task without changing code. Read its task card, acceptance criteria, current git diff and relevant tests. Verify each criterion with evidence, rerun the specified checks where safe, and report: pass/fail per criterion, regressions, security/data-migration risks, missing tests and whether the next dependent task may start. Do not edit, commit, push, migrate or deploy.
```

### Recover from failure

```text
Inspect the failed command, complete error output, current git diff and the active Nurset task card. Determine the smallest root-cause repair that stays inside the active task. Present a short repair plan, files likely affected, verification commands and rollback approach, then wait for approval before editing. Do not broaden scope, add dependencies, discard user changes, commit, push, migrate or deploy.
```
