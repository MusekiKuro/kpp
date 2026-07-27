# N01 — Staging migration rehearsal runbook

Дата подготовки: 2026-07-27.

Этот документ предназначен только для отдельного Supabase staging-проекта.
Он не разрешает подключение к production, не содержит реквизитов доступа и не
заменяет подтверждение владельца перед удалёнными командами.

## 1. Обязательные входные данные

Оператор должен заполнить локально или в утверждённой системе релизных
доказательств, но не коммитить в Git:

- staging project ref: `<STAGING_PROJECT_REF>`;
- подтверждение, что project ref не относится к production;
- оператор и время окна работ;
- точный Git commit или иной неизменяемый идентификатор проверяемого кода;
- backup/restore point ID и время его проверки;
- утверждённый способ восстановления;
- версия Supabase CLI;
- место хранения обезличенного журнала выполнения.

Стоп-условия:

- staging project ref не подтверждён владельцем;
- нет проверенного backup/restore point;
- рабочая копия не соответствует зафиксированному commit/снимку;
- команда показывает production project ref;
- migration history расходится с локальными файлами;
- вывод может раскрыть access token, database password, service-role key или
  connection string.

## 2. Локальный preflight

Из `D:\KP\nurset-app`:

```powershell
npm.cmd run db:contract-check
git diff --check
Get-ChildItem -LiteralPath .\supabase\migrations -File |
  Sort-Object Name |
  Select-Object -ExpandProperty Name
```

Ожидается ровно десять миграций в следующем порядке:

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

Любое отличие требует остановки и review. Статический contract check не
доказывает, что SQL применим к реальной базе.

## 3. Backup/restore point

До link или `db push`:

1. В Supabase Dashboard открыть именно staging-проект и раздел
   `Database > Backups`.
2. Зафиксировать ID/время доступного backup или PITR restore point.
3. Проверить, что выбранный план действительно допускает восстановление.
4. Зафиксировать ответственного за restore и критерий остановки.
5. Учесть, что database backup не восстанавливает физические Storage objects;
   для них нужен отдельный инвентарный список/план.

Если управляемого backup нет, оператор отдельно утверждает логический dump и
проверяет его восстановление на одноразовом проекте. Файлы dump нельзя хранить
в репозитории.

## 4. Link и проверка цели

Supabase CLI должен быть установлен и утверждён оператором. Не передавайте
пароли и токены аргументами, которые попадут в shell history или журнал.

```powershell
supabase --version
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase migration list
```

Перед продолжением оператор повторно сверяет показанный remote project и
migration history. При расхождении не запускать `migration repair` автоматически:
сохранить обезличенный diff истории и остановиться на review.

Запрещено использовать `supabase db reset --linked`: эта команда удаляет
пользовательские сущности удалённой базы.

## 5. Dry-run и применение

Сначала только план:

```powershell
supabase db push --linked --dry-run
```

Оператор должен увидеть только ожидаемые десять миграций или корректный
неприменённый хвост из этого списка. Не использовать `--include-seed`.

После отдельного подтверждения точного dry-run владельцем:

```powershell
supabase db push --linked
supabase migration list
supabase db push --linked --dry-run
```

Критерии успеха:

- первая команда завершилась с кодом 0;
- migration history содержит применённые версии без пропусков;
- повторный dry-run не предлагает повторное применение;
- в журнале нет секретов и connection strings;
- неожиданные предупреждения разобраны, а не проигнорированы.

При любой SQL-ошибке не редактировать историю миграций и не переходить к N02.
Сохранить название миграции, SQLSTATE/безопасный текст ошибки и остановиться.

## 6. Rollback rehearsal

Rollback для этой задачи — восстановление проверенного staging backup/копии,
а не обратный destructive SQL поверх неизвестного состояния.

1. На одноразовом staging/клоне подтвердить, что выбранный restore point
   доступен оператору.
2. Зафиксировать время начала/окончания и результат восстановления.
3. После restore повторно снять migration history и контрольные row counts.
4. Не удалять migration history и legacy-таблицы вручную.
5. Не выполнять rehearsal на production.

## 7. Шаблон обезличенного evidence

```text
Task: N01 staging migration rehearsal
Date/time and timezone:
Operator:
Approved staging ref fingerprint (не полный ref):
Verified non-production: yes/no
Immutable code identifier:
Supabase CLI version:
Backup/restore point ID:
Backup verified at:
Preflight contract check: pass/fail
Preflight diff check: pass/fail
Migration list before:
Dry-run result:
Owner approval for apply:
Apply result and exit code:
Migration list after:
Second dry-run result:
Rollback rehearsal result:
Unexpected warnings/errors:
Secrets removed from evidence: yes/no
Decision: PASS/BLOCKED
```

N01 считается завершённой только при `PASS` с приложенным staging evidence.
До этого N02 и N03 остаются заблокированы.

## 8. Официальные ссылки

- Supabase database migrations:
  https://supabase.com/docs/guides/deployment/database-migrations
- Supabase CLI migration/db push reference:
  https://supabase.com/docs/reference/cli/v0/supabase-migration
- Supabase database backups:
  https://supabase.com/docs/guides/platform/backups
- Supabase environment management:
  https://supabase.com/docs/guides/deployment/managing-environments
