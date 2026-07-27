# Итоговый отчёт по локальной инженерной работе (Stages M01–M06)

**Дата составления:** 2026-07-27
**Репозиторий:** `D:\KP\nurset-app`
**Итоговый вердикт:** **ЛОКАЛЬНАЯ ИНЖЕНЕРНАЯ ЧАСТЬ M01–M06 ПОЛНОСТЬЮ ЗАВЕРШЕНА. СТАТУС РЕЛИЗА: ЗАБЛОКИРОВАН ОФИЦИАЛЬНЫМИ STAGING И OWNER GATES.**

---

## 1. Статус этапов M01–M06

| Этап | Описание | Статус | Примечание / Результат |
| --- | --- | --- | --- |
| **M01** | XLSX import end-to-end | **COMPLETED** | Парсинг только на сервере (`exceljs`), magic bytes validation, многолистовая инспекция (`inspectXlsx`), API `/api/admin/imports/preview-xlsx`, UI mapping & staging workflow без клиентского `file.text()`. |
| **M02** | Text-to-JSON AI agent contract | **COMPLETED** | Контракт v1.1.0 согласован, provenance tracking, formal warnings, принудительные draft дефолты (`publication_status = 'draft'`, `publish_ru = false`, `publish_kk = false`), промпт-инъекция изолирована как plain text data. |
| **M03** | Product CMS Dialog accessibility | **COMPLETED** | Добавлены `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cms-dialog-title"`, `aria-label` для кнопки закрытия, focus trap (Tab/Shift+Tab), закрытие по `Escape`, восстановление фокуса на открывавшем элементе. |
| **M04** | Runtime entrypoint cleanup worker | **COMPLETED** | Безопасный server-only HTTP маршрут `/api/admin/cron/cleanup-storage` защищён `CRON_SECRET` с постоянным временем сравнения `crypto.timingSafeEqual`, без использования `NEXT_PUBLIC_*` и с изоляцией параметров вызова. |
| **M05** | Owner & release docs alignment | **COMPLETED** | Честность статусов: черновики юридических данных и неопубликованная политика privacy (`noindex`) явно отражены в `OWNER_RELEASE_GATES_CHECKLIST.md`. `SECURITY_INCIDENT.md` оставлен открытым (**OPEN**). Добавлен полный `owner_input_template`. |
| **M06** | Итоговый локальный gate | **COMPLETED** | Все локальные статические, unit, build и security-проверки выполнены и задокументированы. |

---

## 2. Причины блокировки релиза (BLOCKED)

Выпуск приложения в production/staging заблокирован по следующим объективным причинам:
1. **Отсутствие Staging Supabase окружения:** Миграции схемы (включая `20260724040000_complete_catalog_runtime_contracts.sql`) не применимы до предоставления отдельного staging project и санкционирования оператора.
2. **Открытый Security Incident:** `SECURITY_INCIDENT.md` требует подтверждённой человеком ротации скомпрометированного service-role ключа в панели Supabase.
3. **Отсутствие официальных данных владельца:** Юридическое наименование, БИН/ИИН, адреса, контакты, условия доставки/гарантии и текст политики конфиденциальности не заполнены владельцем.
4. **Невыбранный хостинг и планировщик:** Платформа размещения, внешний cron-планировщик и edge WAF/rate-limit не согласованы.

---

## 3. Отложенные гейты (Deferred Live Gates)

Следующие проверки сознательно отложены до этапа staging/production и **не имитировались**:
- **N01:** Staging migration apply, backup & restore point, rollback rehearsal.
- **N02:** Live RLS & RPC matrix check (anon / auth / admin / service-role).
- **N03:** End-to-end browser smoke на staging URL (RU/KZ каталог, фильтры, формы заявок, админка).
- **N05:** Staging XLSX dry-run & explicit `APPLY` с реальной базой данных.
- **N07:** Live scheduler execution, concurrency lease lock test (2 воркера), retries, alert triggers.
- **N08:** Подпись чек-листа владельцем (Owner sign-off) и подстановка реальных реквизитов.
- **N09:** Окончательное решение владельца GO / NO-GO.

---

## 4. Все изменённые и созданные файлы

### Созданные файлы:
- `app/api/admin/imports/preview-xlsx/route.js` — Server-only XLSX inspection endpoint.
- `app/api/admin/cron/cleanup-storage/route.js` — Secure server-only cleanup worker cron invocation.
- `fixtures/import/t10-adversarial-injection.json` — Prompt injection security test fixture.
- `test/product-cms-accessibility.test.mjs` — CMS modal accessibility & focus trap tests.
- `docs/M06_LOCAL_ENGINEERING_REPORT.md` — Данный итоговый отчёт.

### Изменённые файлы:
- `lib/import-xlsx.mjs` — Добавлена проверка ZIP magic bytes `PK\x03\x04`, инспекция листов `inspectXlsx`, выбор листа, защита от формул.
- `lib/import-ui.mjs` — Убран устаревший запрет XLSX для бинарных источников.
- `lib/import-staging.mjs` — Расширен список разрешённых `sourceType` (`xlsx`).
- `components/admin/ImportWorkflow.js` — Добавлена поддержка `.xlsx`, серверный превью-запрос, переключение листов, убрана заглушка «XLSX отключён».
- `components/admin/ProductCMS.js` — Реализованы `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape, focus restore, `motion-reduce`.
- `test/import-xlsx.test.mjs` — Добавлены тесты magic bytes, инспекции листов, выбора целевого листа.
- `test/import-ui.test.mjs` — Обновлён assertion на превью-ошибку бинарного XLSX.
- `test/gallery.test.mjs` — Добавлены тесты защиты `CRON_SECRET` для эндпоинта отчистки.
- `docs/CLEANUP_WORKER_OPERATIONAL_RUNBOOK.md` — Актуализирован разделением локальной реализации и отложенных хостинг-решений.
- `docs/OWNER_RELEASE_GATES_CHECKLIST.md` — Исправлены противоречия, отражены честные черновики, добавлен `owner_input_template`.

---

## 5. Выполненные команды и результаты

| Команда | Код возврата | Результат |
| --- | ---: | --- |
| `npm.cmd run db:contract-check` | **0** | Статическая целостность миграций и репозиториев подтверждена. |
| `node --test test/import-xlsx.test.mjs` | **0** | 6/6 тестов XLSX прошли (включая magic bytes и multi-sheet). |
| `npm.cmd run import:dry-run -- --input fixtures/import/t10-valid.json` | **0** | Валидный JSON импортирован корректно (`create: 1`). |
| `npm.cmd run import:dry-run -- --input fixtures/import/t10-invalid.json` | **1 (expected)** | Ожидаемый отказ с 4 ошибками валидации (`error: 1`). |
| `npm.cmd run import:dry-run -- --input fixtures/import/t10-adversarial-injection.json` | **0** | Инъекция изолирована как plain text string; публикация/роли не изменены. |
| `npm.cmd run test` | **0** | 125/125 unit-тестов прошли без ошибок. |
| `npm.cmd run lint` | **0** | 0 ошибок, 4 существующих предупреждения `no-img-element`. |
| `npm.cmd run build` | **0** | Успешно скомпилировано 45 страниц/маршрутов (Next.js 16.2.9 Turbopack). |
| `npm.cmd run security:scan` | **0** | 107 файлов проверено, секреты не обнаружены. |
| `git diff --check` | **0** | Whitespace-ошибки отсутствуют. |

---

## 6. Что НЕ проверено

1. Применение миграций PostgreSQL к реальной базе данных Supabase.
2. Исполнение RLS-политик через реальные API-сессии (anon, non-admin, admin, service-role).
3. Браузерный сквозной smoke-тест интерфейса на staging URL с живыми данными.
4. Конкурентный запуск двух реальных worker'ов очистки хранилища.
5. Физическое удаление объектов из бакета Supabase Storage.
6. Внешний запуск cron по расписанию.

---

## 7. Остаточные риски безопасности и данных

1. **Service Role Key Incident:** Если не выполнить ротацию скомпрометированного ключа в Supabase Dashboard до деплоя, злоумышленники могут получить полный доступ к БД.
2. **Missing Customer Legal Facts:** Выпуск сайта с черновиками или незаполненными реквизитами/политикой privacy создаёт юридические риски.
3. **Lack of Edge Rate Limiting:** В публичном API заявок без платформенного rate limiter'а (Cloudflare/WAF) возможен спам заявками.

---

## 8. Минимальный следующий шаг

1. Передать владельцу бизнеса документ `docs/OWNER_RELEASE_GATES_CHECKLIST.md` и затребовать заполнение `owner_input_template`.
2. Запросить у оператора Supabase Staging Project credentials для проведения репетиции миграций (N01).
3. Выполнить ротацию `SUPABASE_SERVICE_ROLE_KEY` в панелях Supabase и секретах хостинга.
