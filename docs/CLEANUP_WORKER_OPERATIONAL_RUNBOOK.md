# Операционный регламент Cleanup Worker и защита платформ (Task N07 / Stage M04)

**Документ:** CLEANUP_WORKER_OPERATIONAL_RUNBOOK.md
**Дата:** 2026-07-27
**Статус:** Приложение реализовано локально; хостинг/планировщик/WAF — `Confirm first` (Ожидает решения владельца)
**Область:** `lib/storage-cleanup-processor.mjs`, `scripts/process-storage-cleanup.mjs`, `app/api/admin/cron/cleanup-storage/route.js`

---

## 1. Рекурсивный статус реализации

### Реализовано в приложении (Local Implementation):
- **Серверный HTTP Entrypoint:** `/api/admin/cron/cleanup-storage` (только `POST`).
- **Защита доступа:** Заголовок `x-cron-secret` или `Authorization: Bearer <CRON_SECRET>` с проверкой `crypto.timingSafeEqual`.
- **Изоляция секретов:** `CRON_SECRET` и `SUPABASE_SERVICE_ROLE_KEY` только в server-side environment (`NEXT_PUBLIC_*` запрещены).
- **Изоляция параметров:** Внешние клиенты не могут передавать `bucket`, `storage_path` или `job_id`.
- **Гарантия батча:** Фиксированный лимит 50 задач за вызов.
- **Безопасные цели удаления (`isSafeCleanupTarget`):** Разрешён только бакет `product-images` без path traversal (`..`, `\`, leading `/`).

### Не выбрано / Отложено до релиза (`Confirm first`):
- Конкретная платформа хостинга (Vercel / VPS / Docker / Cloudflare Workers).
- Конкретный внешний планировщик (Vercel Cron / GitHub Actions / Linux crontab / Cloudflare Triggers).
- Настройка секретов в менеджере платформы (Secret Store).
- Распределённый rate limit / WAF на уровне edge (Cloudflare / Fastly).
- Проведение live staging concurrency и failure tests.

---

## 2. Архитектура и гарантии очереди отчистки объектов

Подсистема фоновой отчистки удалённых изображений товаров использует таблицу `storage_cleanup_queue` и RPC-функцию `claim_storage_cleanup_jobs`.

### Гарантии защиты и параллелизма:
1. **Атомарный захват (Lock & Lease):** Вызов `claim_storage_cleanup_jobs` использует `FOR UPDATE SKIP LOCKED` с токеном аренды (`lease_token`) на `600 секунд`. Два одновременно запущенных воркера гарантированно **не могут перехватить одну и ту же задачу**.
2. **Проверка владения арендой:** Завершение (`markCompleted`) и фиксация ошибки (`markFailed`) выполняются со строгим условием `WHERE lease_token = job.lease_token AND status = 'processing'`. Если срок аренды истёк или задание было перехвачено повторно, запись отклоняется с вызовом `StorageCleanupProcessorError`.
3. **Безопасные цели удаления (`isSafeCleanupTarget`):**
   - Разрешён только бакет `product-images`.
   - Путь файла проверяется на отсутствие path traversal (`..`, `\`, ведущий `/`).
4. **Повторные попытки и экспоненциальный бэкофф:**
   - Задержка между попытками рассчитывается по формуле: `5 * (2^(attempts - 1))` минут.
   - 1 попытка: через 5 минут;
   - 2 попытка: через 10 минут;
   - 3 попытка: через 20 минут;
   - 4 попытка: через 40 минут (максимум до 24 часов).

---

## 3. Инструкция по вызову и настройке планировщика

Скрипт воркера можно запустить локально или в CLI:
```powershell
npm.cmd run storage:cleanup
```

Или вызовом серверного эндпоинта:
```http
POST /api/admin/cron/cleanup-storage
x-cron-secret: <CRON_SECRET_VALUE>
```

### Возможные варианты настройки запуска (`Confirm first`):

#### Вариант А: Vercel Cron Jobs (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/admin/cron/cleanup-storage",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

#### Вариант Б: Linux crontab / systemd timer (VPS / Docker)
```cron
*/15 * * * * cd /var/www/nurset-app && CRON_SECRET="$SECRET" SUPABASE_SERVICE_ROLE_KEY="$KEY" /usr/bin/node scripts/process-storage-cleanup.mjs >> /var/log/nurset-cleanup.log 2>&1
```

---

## 4. Хранение секретов и доступ

> [!CAUTION]
> Ключи `CRON_SECRET` и `SUPABASE_SERVICE_ROLE_KEY` обладают привилегированным доступом.

- Ключи должны храниться **исключительно** в зашифрованном Secret Store платформы (Vercel Environment Variables / Docker Secrets / Vault).
- Категорически запрещено передавать ключи в клиентский JS-бандл или сохранять в публичные файлы `.env`.

---

## 5. Мониторинг, метрики и алертинг

1. **Метрики воркера:**
   - `processed`: количество захваченных задач;
   - `succeeded`: успешно удалённые объекты;
   - `failed`: задачи с ошибкой удаления.
2. **Пороги срабатывания алертов:**
   - `CRITICAL`: Зафиксированы задачи со статусом `failed` и `attempts >= 5` (требуют вмешательства оператора).
   - `WARNING`: Зафиксировано более 10 неудачных попыток за 1 час.

---

## 6. Рекомендации по Rate Limiting и WAF для публичных эндпоинтов

Для защиты публичных API (`/api/quote-requests` и каталога) на уровне платформы/edge (Cloudflare / Edge Proxy) рекомендуются следующие лимиты:

1. **Отправка заявок (`POST /api/quote-requests`):**
   - Rate limit: **5 запросов в минуту** с одного IP.
   - WAF Rule: Проверка капчи/Bot Management при превышении порога.
2. **Публичный каталог (`GET /api/products`):**
   - Rate limit: **60 запросов в минуту** с одного IP.
