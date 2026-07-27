-- Synthetic staging fixtures only. Never run this against production.
-- All IDs are fixed so the script can be safely re-run on the disposable staging project.

DELETE FROM public.quote_request_items WHERE quote_request_id = 'f1111111-1111-4111-8111-111111111111';
DELETE FROM public.quote_requests WHERE id = 'f1111111-1111-4111-8111-111111111111';
DELETE FROM public.product_attribute_values WHERE product_id IN ('f2111111-1111-4111-8111-111111111111', 'f2222222-2222-4222-8222-222222222222');
DELETE FROM public.product_images WHERE product_id IN ('f2111111-1111-4111-8111-111111111111', 'f2222222-2222-4222-8222-222222222222');
DELETE FROM public.products WHERE id IN (
  'f2111111-1111-4111-8111-111111111111',
  'f2222222-2222-4222-8222-222222222222',
  'f3333333-3333-4333-8333-333333333333',
  'f4444444-4444-4444-8444-444444444444'
);
DELETE FROM public.attributes WHERE id IN ('f3111111-1111-4111-8111-111111111111', 'f3222222-2222-4222-8222-222222222222');
DELETE FROM public.brands WHERE id IN ('f4111111-1111-4111-8111-111111111111', 'f4222222-2222-4222-8222-222222222222');
DELETE FROM public.categories WHERE id IN (
  'f5111111-1111-4111-8111-111111111111',
  'f5222222-2222-4222-8222-222222222222',
  'f5333333-3333-4333-8333-333333333333'
);

INSERT INTO public.categories (id, slug, name_ru, name_kk, sort_order, status) VALUES
  ('f5111111-1111-4111-8111-111111111111', 'noutbuki', 'Ноутбуки', 'Ноутбуктер', 1, 'published'),
  ('f5222222-2222-4222-8222-222222222222', 'interaktivnye-paneli', 'Интерактивные панели', 'Интерактивті панельдер', 2, 'published'),
  ('f5333333-3333-4333-8333-333333333333', 'mebel', 'Мебель', 'Жиһаз', 3, 'published')
ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, name_kk = EXCLUDED.name_kk, status = EXCLUDED.status;

INSERT INTO public.brands (id, slug, name, status, sort_order) VALUES
  ('f4111111-1111-4111-8111-111111111111', 'lenovo', 'Lenovo', 'published', 1),
  ('f4222222-2222-4222-8222-222222222222', 'newline', 'Newline', 'published', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

INSERT INTO public.attributes (id, category_id, code, name_ru, name_kk, data_type, unit_ru, unit_kk, is_filterable, status, options) VALUES
  ('f3111111-1111-4111-8111-111111111111', 'f5111111-1111-4111-8111-111111111111', 'screen_size', 'Диагональ экрана', 'Экран диагоналі', 'number', 'дюйм', 'дюйм', true, 'published', '[]'),
  ('f3222222-2222-4222-8222-222222222222', 'f5222222-2222-4222-8222-222222222222', 'panel_type', 'Тип панели', 'Панель түрі', 'option', NULL, NULL, true, 'published', '["interactive", "touch"]');

INSERT INTO public.products (
  id, name, category, description, sort_order, sku, slug, category_id, brand_id,
  name_ru, name_kk, short_description_ru, short_description_kk, description_ru, description_kk,
  price_mode, price_amount, old_price_amount, currency, stock_status,
  publication_status, publish_ru, publish_kk, translation_status_kk, is_featured, image_url
) VALUES
  ('f2111111-1111-4111-8111-111111111111', 'Lenovo ThinkBook 15 G5', 'Ноутбуки', 'Synthetic published Russian laptop fixture.', 1, 'STAGE-LEN-001', 'lenovo-thinkbook-15-g5', 'f5111111-1111-4111-8111-111111111111', 'f4111111-1111-4111-8111-111111111111', 'Lenovo ThinkBook 15 G5', NULL, 'Бизнес-ноутбук для тестирования каталога.', NULL, 'Synthetic published Russian laptop fixture.', NULL, 'exact', 450000, 500000, 'KZT', 'in_stock', 'published', true, false, 'missing', true, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800'),
  ('f2222222-2222-4222-8222-222222222222', 'Newline Lyra Pro 75', 'Интерактивные панели', 'Synthetic bilingual panel fixture.', 2, 'STAGE-NWL-001', 'newline-lyra-pro-75', 'f5222222-2222-4222-8222-222222222222', 'f4222222-2222-4222-8222-222222222222', 'Newline Lyra Pro 75', 'Newline Lyra Pro 75', 'Интерактивная панель для учебных классов.', 'Интерактивті панель оқу сыныптарына арналған.', 'Synthetic bilingual panel fixture.', 'Оқу сыныптарына арналған синтетикалық тест тауары.', 'from', 1250000, NULL, 'KZT', 'on_order', 'published', true, true, 'verified', false, 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800'),
  ('f3333333-3333-4333-8333-333333333333', 'Draft staging product', 'Мебель', 'Synthetic draft fixture.', 3, 'STAGE-DRAFT-001', 'draft-staging-product', 'f5333333-3333-4333-8333-333333333333', NULL, 'Draft staging product', NULL, NULL, NULL, 'Synthetic draft fixture.', NULL, 'request', NULL, NULL, 'KZT', 'unknown', 'draft', false, false, 'missing', false, NULL),
  ('f4444444-4444-4444-8444-444444444444', 'Archived staging product', 'Мебель', 'Synthetic archived fixture.', 4, 'STAGE-ARCH-001', 'archived-staging-product', 'f5333333-3333-4333-8333-333333333333', NULL, 'Archived staging product', NULL, NULL, NULL, 'Synthetic archived fixture.', NULL, 'hidden', NULL, NULL, 'KZT', 'out_of_stock', 'archived', false, false, 'missing', false, NULL);

INSERT INTO public.product_images (id, product_id, storage_path, source_url, alt_ru, alt_kk, sort_order, is_primary) VALUES
  ('f6111111-1111-4111-8111-111111111111', 'f2111111-1111-4111-8111-111111111111', 'fixtures/lenovo-main.jpg', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800', 'Lenovo ThinkBook 15 G5', NULL, 0, true),
  ('f6222222-2222-4222-8222-222222222222', 'f2222222-2222-4222-8222-222222222222', 'fixtures/newline-main.jpg', 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800', 'Newline Lyra Pro 75', 'Newline Lyra Pro 75', 0, true),
  ('f6333333-3333-4333-8333-333333333333', 'f2222222-2222-4222-8222-222222222222', 'fixtures/newline-detail.jpg', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800', 'Newline detail', 'Newline detail', 1, false);

INSERT INTO public.product_attribute_values (product_id, attribute_id, value_number, raw_value) VALUES
  ('f2111111-1111-4111-8111-111111111111', 'f3111111-1111-4111-8111-111111111111', 15.6, '15.6'),
  ('f2222222-2222-4222-8222-222222222222', 'f3111111-1111-4111-8111-111111111111', 75, '75');
INSERT INTO public.product_attribute_values (product_id, attribute_id, value_option, raw_value) VALUES
  ('f2222222-2222-4222-8222-222222222222', 'f3222222-2222-4222-8222-222222222222', 'interactive', 'interactive');

INSERT INTO public.quote_requests (id, customer_name, customer_phone, customer_email, organization, city, customer_message, locale, consent_personal_data, source_url, status) VALUES
  ('f1111111-1111-4111-8111-111111111111', 'Тестовый клиент', '+77000000001', 'staging@example.invalid', 'Synthetic staging organization', 'Алматы', 'Synthetic quote request fixture.', 'ru', true, 'https://staging.example.invalid/ru/catalog', 'new');
INSERT INTO public.quote_request_items (id, quote_request_id, product_id, quantity, sku_snapshot, name_snapshot, image_url_snapshot, price_mode_snapshot, price_amount_snapshot, currency_snapshot, sort_order) VALUES
  ('f7111111-1111-4111-8111-111111111111', 'f1111111-1111-4111-8111-111111111111', 'f2111111-1111-4111-8111-111111111111', 1, 'STAGE-LEN-001', 'Lenovo ThinkBook 15 G5', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800', 'exact', 450000, 'KZT', 0);
