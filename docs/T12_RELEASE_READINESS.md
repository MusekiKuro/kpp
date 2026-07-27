# T12 — состояние готовности релиза

Дата локальной проверки: 2026-07-24.

Примечание: таблицы ниже содержат исторический срез на 24 июля. Более свежие
локальные результаты на 27 июля зафиксированы в `docs/M06_LOCAL_ENGINEERING_REPORT.md`
и `docs/REMAINING_WORK_AND_RELEASE_PLAN.md` (125/125 тестов, build PASS).

## Вердикт

**Локальные статические, unit и build-проверки проходят. Релиз и полноценный browser smoke заблокированы обязательными staging-гейтами.**

Этот документ не подтверждает, что миграции применяются к реальной базе без ошибок, что RLS работает в Supabase или что каталог доступен с production-данными. Для такого подтверждения нужна отдельная staging-проверка.

## Что исправлено локально

- публичный каталог больше не читает `product_attribute_values` напрямую: фильтры характеристик используют ограниченный `SECURITY DEFINER` RPC, который возвращает только ID опубликованных товаров нужной локали;
- создание изображения передаёт `is_primary` в один атомарный RPC;
- переключение главного изображения сначала снимает прежний primary, затем назначает новый в той же транзакции и под блокировкой товара;
- удаление изображения создаёт recoverable cleanup job внутри транзакции БД;
- cleanup worker атомарно получает задания через `FOR UPDATE SKIP LOCKED`, использует lease token и проверяет владение lease при завершении;
- option-атрибуты используют канонический массив уникальных строк, редактируются в taxonomy CMS и выбираются через `select` в Product CMS;
- `db:contract-check` явно обозначен как статическая проверка, а не как PostgreSQL parser или доказательство применимости миграций.

Итоговая корректирующая миграция: `supabase/migrations/20260724040000_complete_catalog_runtime_contracts.sql`.

## Фактические результаты локальных команд

| Команда | Код | Результат |
| --- | ---: | --- |
| `npm.cmd run db:contract-check` | 0 | Статические SQL/репозиторные контракты прошли; live DB не проверена. |
| `npm.cmd run test` | 0 | 64/64 теста прошли. Есть существующие Node-предупреждения `MODULE_TYPELESS_PACKAGE_JSON`. |
| `npm.cmd run lint` | 0 | Ошибок нет; 4 существующих предупреждения `no-img-element`. |
| `npm.cmd run build` | 0 | Next.js собрал 43 страницы/маршрута. Во время sitemap/catalog data load были ошибки подключения к текущему Supabase, поэтому это не считается чистым runtime smoke. |
| `npm.cmd run security:scan` | 0 | 107 файлов проверено, секреты не найдены; 12 удалённых tracked-файлов пропущены. |
| `npm.cmd run backfill:dry-run` | 0 | 4 create, 3 update, 1 skip, 1 review error. |
| `npm.cmd run backfill:dry-run -- --format sql` | 0 | Транзакционный SQL сформирован, но не применялся. |
| `npm.cmd run import:dry-run -- --input fixtures/import/t09-valid.json` | 0 | Валидный импорт принят. |
| `npm.cmd run import:dry-run -- --input fixtures/import/t10-valid.json` | 0 | Валидный agent fixture принят. |
| `npm.cmd run import:dry-run -- --input fixtures/import/t10-invalid.json` | 2 | Ожидаемый отказ с четырьмя ошибками валидации. |
| `npm.cmd run import:dry-run -- --input fixtures/import/t09-malformed.csv` | 1 | Ожидаемый отказ malformed input. |
| `git diff --check` | 0 | Whitespace-ошибок нет; присутствуют предупреждения LF/CRLF. |

## Что локальные проверки не доказывают

- `db:contract-check` использует статические правила и не исполняет SQL в PostgreSQL;
- Docker/PostgreSQL/Supabase CLI в текущей среде недоступны, поэтому локальный migration apply не выполнялся;
- текущая `.env.local` во время build не дала загрузить каталог и sitemap; секреты не просматривались и не изменялись;
- browser smoke подтвердил загрузку `/ru` и казахской `/kk/about` с корректными заголовками/навигацией, но `/ru/catalog` перешёл в безопасное состояние «Каталог временно недоступен» из-за тех же Supabase-ошибок;
- мобильный smoke 320 px, admin flows и RLS matrix должны быть воспроизведены после применения миграций на staging;
- `npm.cmd run storage:cleanup` нельзя запускать до применения новой миграции и настройки server-only service-role окружения.

## Статус выполнения задачи N01 (Репетиция миграций на staging)

Дата проведения: 2026-07-26.

- **Локальные проверки:**
  - `npm.cmd run db:contract-check`: пройден (код 0). Подтверждена статическая целостность контрактов 10 миграций.
  - `git diff --check`: пройден (код 0). Утечки секретов и ошибок пробелов не обнаружены.
  - `npm.cmd run test`: пройден (64/64 теста).
- **Список миграций к применению на Staging (в порядке файлов):**
  1. `20260722000000_harden_security_and_indexes.sql`
  2. `20260722010000_add_catalog_domain.sql`
  3. `20260723000000_add_quote_idempotency_consent.sql`
  4. `20260723010000_add_t08_cms_fields.sql`
  5. `20260723020000_add_import_apply_rpc.sql`
  6. `20260724000000_secure_catalog_boundary.sql`
  7. `20260724010000_disable_public_orders_insert.sql`
  8. `20260724020000_add_cms_atomic_update_and_triggers.sql`
  9. `20260724030000_add_gallery_atomic_and_primary_invariant.sql`
  10. `20260724040000_complete_catalog_runtime_contracts.sql`
- **Human Gate Status:** Ожидает подтверждённого staging project ref, backup/restore point и ручного запуска оператором по [`STAGING_MIGRATION_RUNBOOK.md`](./STAGING_MIGRATION_RUNBOOK.md).

## Обязательные human gates

1. Сделать backup staging Supabase и применить миграции по порядку, включая `20260724040000_complete_catalog_runtime_contracts.sql`.
2. Проверить RLS-матрицу для `anon`, обычного `authenticated` и администратора.
3. Проверить RU/KZ каталог, фильтры характеристик, карточку товара, primary gallery и quote request на staging.
4. Запустить два cleanup worker одновременно и подтвердить отсутствие двойного claim одного job.
5. Отрепетировать rollback/restore из backup.
6. Выполнить ротацию ранее скомпрометированного service-role ключа и закрыть security incident.
7. Получить подтверждённые реквизиты, контакты, условия доставки/гарантии и privacy-текст владельца.
8. Только после этих пунктов обновить статус на release-ready.
