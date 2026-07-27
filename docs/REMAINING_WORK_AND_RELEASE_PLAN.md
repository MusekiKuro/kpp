# Nurset: оставшиеся работы и план выхода в production

**Актуально на:** 27 июля 2026 года
**Репозиторий:** `D:\KP\nurset-app`
**Текущий статус:** **LOCAL PASS. Production release заблокирован staging-проверками, security gate и решениями владельца.**

## 1. Назначение документа

Это единая точка правды по работам, которые остались после завершения локальной инженерной фазы. Документ не заменяет подробные runbook и checklist, а задаёт порядок действий, зависимости и критерии завершения.

Связанные документы:

- `docs/STAGING_MIGRATION_RUNBOOK.md` — применение миграций на staging;
- `docs/T02_MIGRATION_ROLLBACK.md` — порядок отката;
- `docs/T07_RLS_CHECKLIST.md` — проверка RLS;
- `docs/CLEANUP_WORKER_OPERATIONAL_RUNBOOK.md` — эксплуатация cleanup worker;
- `docs/OWNER_RELEASE_GATES_CHECKLIST.md` — данные и подписи владельца;
- `docs/SECURITY_INCIDENT.md` — открытый инцидент с привилегированным ключом;
- `docs/RELEASE_CHECKLIST.md` — общий release checklist.

## 2. Что уже завершено локально

Локальная инженерная часть принята в статусе `LOCAL PASS`:

- серверный импорт JSON, CSV и XLSX через staging, preview, approval и явный `APPLY`;
- полный XLSX-поток без обрезания после 500 preview-строк;
- выбор листа и серверное применение column mapping;
- лимиты размера, строк, колонок, ячеек и предварительная проверка ZIP/OOXML;
- защита формульных ячеек и prompt injection;
- контракт text-to-JSON v1.1.0 с provenance и structured warnings;
- draft-by-default и запрет автоматической публикации импортом;
- Product CMS, защита от двойного сохранения, gallery mutex, rollback и stale-state guards;
- cleanup cron handler с server-only secret и route-level тестами;
- локальные DB contract и secret checks.

Последняя зафиксированная локальная проверка агентом:

| Проверка | Результат |
| --- | --- |
| `npm.cmd run test` | 125/125 PASS |
| Целевые XLSX/CMS-тесты | 26/26 PASS; повторно подтверждено независимой проверкой |
| `npm.cmd run lint` | 0 ошибок, 4 предупреждения `no-img-element` |
| `npm.cmd run build` | PASS, Next.js production build |
| `npm.cmd run db:contract-check` | PASS |
| `npm.cmd run security:scan` | PASS |
| `git diff --check` | PASS |

Эти результаты доказывают локальную целостность кода, но не доказывают работу реальной БД, RLS, Storage, cron и браузерных сценариев на staging.

## 3. Сводка оставшихся работ

| ID | Работа | Статус | Блокирует production | Кто выполняет |
| --- | --- | --- | --- | --- |
| R00 | Зафиксировать проверяемый release candidate | Не выполнено | Да | Разработчик + владелец |
| R01 | Предоставить отдельный Supabase staging | Не выполнено | Да | Владелец/оператор |
| R02 | Репетиция миграций и rollback | Не выполнено | Да | Оператор БД |
| R03 | Live-проверка RLS и RPC | Не выполнено | Да | Разработчик + оператор БД |
| R04 | Подготовить безопасные staging-данные | Не выполнено | Да | Владелец + разработчик |
| R05 | Browser smoke на staging | Не выполнено | Да | QA/владелец |
| R06 | XLSX staging dry-run и контролируемый `APPLY` | Не выполнено | Да | Администратор каталога |
| R07 | Настроить cleanup scheduler и проверить worker | Не выполнено | Да | DevOps/оператор |
| R08 | Закрыть security incident и ротировать ключи | Не выполнено | Да | Владелец Supabase |
| R09 | Выбрать hosting, domain, WAF и rate limits | Не выполнено | Да | Владелец + DevOps |
| R10 | Заполнить юридические данные и тексты | Не выполнено | Да | Владелец |
| R11 | Accessibility/performance smoke | Не выполнено | Да | QA |
| R12 | Финальный RC и решение GO/NO-GO | Не выполнено | Да | Владелец |
| R13 | Production rollout и post-deploy smoke | Не выполнено | Да | DevOps + QA |

## 4. Порядок выполнения

### R00 — Зафиксировать release candidate

До работы со staging необходимо определить точный набор файлов, который проверяется и выпускается.

Действия:

1. Просмотреть весь `git status`, `git diff --stat` и содержательный diff.
2. Убедиться, что удалённые и перемещённые Next.js routes являются ожидаемой миграцией структуры.
3. Исключить временные файлы, логи, локальные credentials и отчёты внешних агентов вне репозитория.
4. Повторить локальные проверки.
5. Только по отдельной команде владельца создать release branch/commit. Не выполнять push автоматически.
6. Зафиксировать commit SHA в staging evidence.

Критерий завершения: существует один обозримый commit/RC SHA, соответствующий повторно прошедшим локальным проверкам.

### R01 — Подготовить отдельный Supabase staging

Нужен отдельный проект, не production.

Владелец должен предоставить или подтвердить:

- staging project reference и URL;
- безопасный способ передачи anon key и server-only service-role key;
- ответственного оператора;
- разрешение на применение миграций;
- backup/restore point;
- тестовые учётные записи: обычный пользователь и admin с ролью только в `app_metadata.role`.

Запрещено сохранять ключи в документах, логах, Git или клиентском bundle.

Критерий завершения: staging изолирован от production, доступ проверен, backup/restore point записан без секретов.

### R02 — Репетиция миграций и rollback

Выполнять по `docs/STAGING_MIGRATION_RUNBOOK.md` и `docs/T02_MIGRATION_ROLLBACK.md`.

Обязательные проверки:

- миграции применены строго в хронологическом порядке;
- присутствуют таблицы, индексы, constraints, policies и RPC, необходимые каталогу, импорту и cleanup;
- повторная проверка состояния миграций не создаёт неожиданных изменений;
- зафиксированы sanitized-команды, время, RC SHA и результат;
- rollback отрепетирован на одноразовом staging/backup либо документально подтверждён оператором;
- после rollback возможен повторный корректный apply.

Критерий завершения: migration log и rollback evidence приложены к release checklist, потери production-данных невозможны.

### R03 — Live RLS и RPC matrix

Проверить реальные права после R02.

Матрица ролей:

| Сценарий | Anon | Auth user | Non-admin | Admin | Service role |
| --- | --- | --- | --- | --- | --- |
| Читать опубликованный RU-каталог | Allow | Allow | Allow | Allow | Allow |
| Читать опубликованный KZ-каталог | Только verified/published | Только verified/published | Только verified/published | Allow | Allow |
| Читать draft/archived через public API | Deny | Deny | Deny | Через admin API | Allow |
| Изменять каталог | Deny | Deny | Deny | Allow | Allow |
| Читать/изменять import batches | Deny | Deny | Deny | Allow | Allow |
| Вызывать admin gallery RPC | Deny | Deny | Deny | Allow | Allow |
| Захватывать cleanup lease | Deny | Deny | Deny | По контракту | Allow |

Дополнительно проверить quote requests, attribute-filter RPC и прямой доступ к таблицам.

Критерий завершения: все positive и negative cases воспроизведены; неожиданный доступ равен `NO-GO`.

### R04 — Безопасные staging-данные

Подготовить небольшой обезличенный набор:

- категории и бренды;
- товары draft/published/archived;
- RU и KZ варианты, включая отсутствующий и verified перевод;
- цены `exact`, `from`, `request`, `hidden`;
- товары без изображения и с галереей;
- тестовые quote requests;
- XLSX минимум на 550 строк и второй лист;
- ошибки: duplicate SKU, неверная цена, неизвестная категория, пустой обязательный field.

Не использовать реальные персональные данные клиентов.

Критерий завершения: fixtures воспроизводимы и могут быть удалены после теста.

### R05 — Browser smoke на staging

Проверить минимум desktop и mobile viewport.

Публичная часть:

- `/`, `/ru`, `/kk` и корпоративные страницы;
- каталог, поиск, категории, бренды, фильтры, сортировка и пагинация;
- карточка товара, цена «по запросу», изображения и fallback;
- языковое переключение, canonical/hreflang, sitemap и robots;
- корзина/заявка и защита от повторной отправки;
- отсутствие draft/archived данных в публичном интерфейсе.

Административная часть:

- login/logout и защита `/admin`;
- запрет доступа non-admin;
- создание, редактирование и архивирование товара;
- RU/KZ поля, SEO, цена, атрибуты и статусы публикации;
- dialog keyboard navigation, focus trap, Escape и возврат фокуса;
- двойной Save вызывает один запрос;
- upload, reorder, primary и delete изображений;
- ошибка gallery API корректно откатывает UI.

Критерий завершения: сценарии пройдены на staging URL, приложены дата, браузер, RC SHA и sanitized evidence.

### R06 — XLSX staging dry-run и `APPLY`

Порядок:

1. Загрузить XLSX с 550 строками и несколькими листами.
2. Убедиться, что preview ограничен образцом, а `totalRows` показывает полный размер.
3. Выбрать не первый лист и настроить mapping.
4. Выполнить Stage и подтвердить, что в batch попали все строки выбранного листа.
5. Проверить ошибки, warnings, diff, duplicate detection и forced draft.
6. Убедиться, что импорт не публикует и не делает товар featured автоматически.
7. Approve только проверенный batch.
8. Ввести `APPLY` на disposable staging data.
9. Проверить create/update/skip/error counters и итоговые записи.
10. Повторный идентичный источник должен отрабатываться по idempotency-контракту.

Критерий завершения: полный batch применён без обрезания, все изменения объяснимы и обратимы.

### R07 — Cleanup scheduler и worker

Выполнять по `docs/CLEANUP_WORKER_OPERATIONAL_RUNBOOK.md`.

Нужно:

- выбрать scheduler: hosting cron, GitHub Actions или другой утверждённый механизм;
- создать новый `CRON_SECRET` в secret manager;
- проверить 401 для отсутствующего/неверного секрета и 200 для верного;
- выполнить dry-run/безопасный тест на staging bucket;
- запустить два worker одновременно и подтвердить отсутствие двойной обработки;
- проверить lease timeout, retries и failed-state;
- проверить физическое удаление только тестовых объектов;
- настроить метрики и оповещения об устойчивых ошибках;
- документировать recovery procedure.

Критерий завершения: scheduler работает по расписанию, конкуренция безопасна, ошибки наблюдаемы.

### R08 — Закрыть security incident

До production обязательно выполнить `docs/SECURITY_INCIDENT.md`.

Действия владельца Supabase:

1. Ротировать ранее потенциально раскрытый service-role key.
2. Обновить секреты staging/hosting только через secret manager.
3. Подтвердить, что старый ключ больше не работает.
4. Проверить Git history, CI logs, deployment logs и доступные audit logs без копирования секретов в отчёт.
5. Повторить `security:scan` и проверить production client bundle.
6. Зафиксировать дату, исполнителя и результат без значения ключа.

Критерий завершения: incident имеет статус `CLOSED`, старый ключ отозван, новый отсутствует в Git и клиентском JS.

### R09 — Hosting, domain, WAF и rate limits

Владелец должен утвердить:

- hosting provider и production project;
- production domain и canonical URL;
- DNS/TLS owner;
- secret storage;
- scheduler;
- логирование и alert channel;
- backup policy;
- WAF/bot protection;
- распределённый rate limiting для публичных API.

Минимально проверить ограничения для quote-request endpoint, upload endpoints, auth и публичного каталога. Конкретные пороги утвердить после staging load test; значения из runbook являются стартовой гипотезой, а не доказанными production-порогами.

Критерий завершения: решения задокументированы и воспроизводимо настроены на staging/production.

### R10 — Данные и тексты владельца

Необходимо получить и согласовать:

- полное юридическое наименование;
- БИН/ИИН, если применимо;
- юридический и фактический адрес;
- телефон, email, часы работы;
- регионы и условия доставки;
- условия оплаты;
- гарантия, возврат и сервис;
- политика конфиденциальности и согласие на обработку данных;
- ответственный за обращения и security incidents;
- финальные RU-тексты и проверенные KZ-переводы;
- production domain/canonical URL.

До согласования нельзя публиковать выдуманные реквизиты или юридические обещания. Privacy draft должен оставаться `noindex`.

Критерий завершения: `docs/OWNER_RELEASE_GATES_CHECKLIST.md` заполнен и подписан владельцем.

### R11 — Accessibility, performance и operational smoke

На staging проверить:

- keyboard-only navigation;
- focus visibility и dialog behavior;
- формы, labels, errors и contrast;
- reduced motion;
- основные страницы в RU и KZ;
- Lighthouse/аналогичные замеры для ключевых страниц;
- размер изображений, LCP/CLS и caching;
- отсутствие секретов и персональных данных в browser console/network;
- поведение при временной недоступности Supabase;
- восстановление после ошибки API.

Известный неблокирующий локальный долг:

- четыре предупреждения ESLint `@next/next/no-img-element`;
- typeless ESM warning в прямом `node --test` запуске.

Их следует устранить отдельным небольшим изменением, если это не ломает внешний image workflow и конфигурацию Next.js. Не добавлять глобально `"type": "module"` без проверки всех scripts/configs.

Критерий завершения: нет критических accessibility/performance ошибок; оставшиеся замечания имеют владельца и срок.

### R12 — Release candidate и GO/NO-GO

Перед решением повторить на точном RC SHA:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run db:contract-check
npm.cmd run security:scan
git diff --check
```

GO разрешён только если:

- R00–R11 завершены;
- migration и rollback evidence сохранены;
- RLS matrix полностью зелёная;
- browser smoke и XLSX staging apply прошли;
- cleanup scheduler работает;
- security incident закрыт;
- owner checklist подписан;
- существует production rollback owner и процедура;
- нет открытых P0/P1 и необработанных P2.

Иначе решение — `NO-GO` либо `GO WITH ACCEPTED RISKS` только с письменным владельцем риска, сроком и планом устранения. Security/RLS/migration blockers нельзя принять как обычный риск.

### R13 — Production rollout и post-deploy smoke

После письменного GO:

1. Зафиксировать backup/restore point.
2. Применить утверждённые миграции в согласованное окно.
3. Развернуть точный RC SHA.
4. Проверить environment variables без вывода значений.
5. Выполнить короткий public/admin smoke без массового изменения данных.
6. Проверить sitemap, robots, canonical, RU/KZ, quote request и admin login.
7. Проверить cron health и error logs.
8. Наблюдать метрики в согласованном окне.
9. При нарушении rollback criteria остановить rollout и выполнить утверждённый rollback.

Критерий завершения: production стабилен, post-deploy checklist подписан, инциденты отсутствуют либо обработаны.

## 5. Параллельные действия владельца

Пока команда готовит R00–R04, владелец может параллельно:

1. Создать/утвердить Supabase staging.
2. Заполнить `OWNER_RELEASE_GATES_CHECKLIST.md`.
3. Выбрать hosting, domain и scheduler.
4. Назначить ответственных за deploy, rollback и incidents.
5. Ротировать service-role key.
6. Утвердить privacy, delivery, warranty и contact data.

Эти действия не требуют ожидания browser smoke и сокращают критический путь выпуска.

## 6. Что нельзя делать без отдельного подтверждения

- применять SQL к staging или production;
- удалять/перезаписывать удалённые данные;
- запускать реальный cleanup worker против рабочего bucket;
- ротировать или изменять credentials;
- создавать commit, push, PR или deploy;
- переключать DNS/domain;
- публиковать юридические тексты и реквизиты;
- выполнять production `APPLY` импортного batch.

## 7. Что не входит в текущий release scope

- онлайн-оплата и эквайринг;
- CRM/ERP-интеграции;
- автономная публикация товаров ИИ-агентом;
- блог и новый раздел услуг;
- полный редизайн;
- мобильное приложение.

Такие задачи формируются после стабилизации текущего каталога и не должны задерживать этот release.

## 8. Ближайший следующий шаг

Сначала выполнить **R00**, затем получить от владельца подтверждение **R01**. После этого выполнять строго последовательно:

`R02 migrations → R03 RLS/RPC → R04 data → R05 browser smoke → R06 XLSX apply → R07 cleanup → R11 quality → R12 GO/NO-GO → R13 production`.

R08–R10 выполняются параллельно, но должны быть полностью закрыты до R12.

До завершения R01 любые формулировки «production ready», «release complete» или «всё проверено» являются некорректными.
