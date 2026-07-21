-- ============================================================
-- Nurset: Supabase Schema (чистый)
-- Запустите весь скрипт в Supabase SQL Editor
-- ============================================================

-- 1. Таблица товаров
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Таблица заявок
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_message TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS для products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for products" ON products;
CREATE POLICY "Public read access for products"
  ON products FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert products" ON products;
CREATE POLICY "Authenticated insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update products" ON products;
CREATE POLICY "Authenticated update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete products" ON products;
CREATE POLICY "Authenticated delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- 4. RLS для orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert orders" ON orders;
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read orders" ON orders;
CREATE POLICY "Authenticated read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated update orders" ON orders;
CREATE POLICY "Authenticated update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete orders" ON orders;
CREATE POLICY "Authenticated delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (true);

-- 5. Storage bucket для изображений
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Удаляем старые политики перед созданием новых
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;

-- Политика: все могут читать файлы
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Политика: авторизованные могут загружать
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Политика: авторизованные могут удалять
CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

-- 6. Начальные данные (Ноутбуки, Моноблоки, Кондиционеры, Мебель)
-- Народные бренды кондиционеров (Midea, Artel, Almacom, Oasis)
-- Доступные брендовые ноутбуки и моноблоки (Lenovo, Acer, HP)
INSERT INTO products (name, category, description, image_url, sort_order) VALUES

-- ═══ НОУТБУКИ ═══
('Ноутбук Lenovo IdeaPad Slim 3 15IAH8', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i3-12450H (8 ядер)
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Вес: 1.62 кг
<!--/FEATURES-->
Доступный ноутбук для учёбы и офисной работы. Процессор H-серии обеспечивает высокую производительность в многозадачности. Тонкий корпус и цифровой блок клавиатуры.', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80', 1),
('Ноутбук Lenovo IdeaPad Slim 3 15IRH8', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-13420H (8 ядер)
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Вес: 1.63 кг
<!--/FEATURES-->
Универсальный ноутбук для работы и учёбы. Мощный процессор 13-го поколения, быстрый SSD на 512 ГБ. Полноразмерная клавиатура с цифровым блоком.', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80', 2),
('Ноутбук Lenovo IdeaPad 1 15AMN7', 'Ноутбуки', '<!--FEATURES-->
Процессор: AMD Ryzen 3 7320U
RAM: 8 ГБ LPDDR5
SSD: 256 ГБ NVMe
Дисплей: 15.6" TN 1920×1080
Графика: AMD Radeon 610M
ОС: без ОС
Вес: 1.58 кг
<!--/FEATURES-->
Самый доступный ноутбук в линейке. Идеален для простых задач: документы, интернет, мессенджеры. Компактный и лёгкий.', 'https://xstore.md/images/product/2025/01/lenovo-ideapad-1-15amn7-2-xstore-md-31.jpg', 3),
('Ноутбук Acer Aspire 3 A315-44P', 'Ноутбуки', '<!--FEATURES-->
Процессор: AMD Ryzen 5 5625U (6 ядер)
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: AMD Radeon Graphics
ОС: без ОС
Вес: 1.78 кг
<!--/FEATURES-->
Надёжный ноутбук для повседневных задач. Процессор AMD Ryzen 5 справляется с офисными приложениями и многозадачностью. Качественный IPS-дисплей.', 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=80', 4),
('Ноутбук Acer Aspire 5 A515-58M', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U (10 ядер)
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.76 кг
<!--/FEATURES-->
Производительный ноутбук с 16 ГБ оперативной памяти. Графика Intel Iris Xe подходит для лёгкой обработки фото и видео. Металлическая крышка.', 'https://laptopmedia.com/wp-content/uploads/2023/05/2-16-e1683646097744.jpg', 5),
('Ноутбук HP 15s-fq5000', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U (6 ядер)
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Вес: 1.69 кг
<!--/FEATURES-->
Доступный ноутбук HP для дома и офиса. Тихая работа, хороший экран и достаточная производительность для повседневных задач.', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80', 6),
('Ноутбук HP 250 G10', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U (10 ядер)
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.74 кг
<!--/FEATURES-->
Бизнес-ноутбук для офиса и учёбы. Надёжная сборка HP, быстрый процессор и вместительный SSD. Идеален для организаций.', 'https://files.foxtrot.com.ua/PhotoNew/img_0_58_28475_0_1_vW6q7f.jpg', 7),
('Ноутбук Acer Aspire Lite AL15-52', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1235U (10 ядер)
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.59 кг
<!--/FEATURES-->
Тонкий и лёгкий ноутбук с большим объёмом памяти. Металлический корпус, узкие рамки экрана. Отлично подходит для мобильной работы.', 'https://www.notebookcheck.it/uploads/tx_nbc2/Acer_Aspire_Lite_15_AL15-52__1_.JPG', 8),

-- ═══ МОНОБЛОКИ ═══
('Моноблок Lenovo IdeaCentre AIO 3 24IAP7', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: белый
<!--/FEATURES-->
Доступный моноблок для дома и офиса. Компактный дизайн, IPS-экран с хорошими углами обзора. Всё необходимое в одном устройстве.', 'https://www.technodom.kz/_next/image?url=https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_lenovo_ideacentre_aio_3_24ada6_white_a3050u_8_267322_1.jpg&w=3840&q=85', 9),
('Моноблок Lenovo IdeaCentre AIO 3 27IAP7', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1235U
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 27" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: черный
<!--/FEATURES-->
Большой 27-дюймовый моноблок для продуктивной работы. Мощный процессор Core i5, быстрый SSD. Встроенные динамики и веб-камера.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', 10),
('Моноблок Acer Aspire C24-1800', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1305U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: серебристый
<!--/FEATURES-->
Компактный моноблок Acer с тонким корпусом. Занимает минимум места на столе. Беспроводная мышь и клавиатура в комплекте.', 'https://www.regard.ru/api/site/cacheimg/goods/6417171/358', 11),
('Моноблок Acer Aspire C27-1800', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 27" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: серебристый
<!--/FEATURES-->
Производительный моноблок с большим 27-дюймовым экраном. 16 ГБ RAM для комфортной многозадачности. Wi-Fi 6 и Bluetooth 5.2.', 'https://kvanto.com.ua/content/images/20/1800x1558l80mc0/35641743044819.jpg', 12),
('Моноблок HP All-in-One 24-cb1038ci', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: белый
<!--/FEATURES-->
Стильный моноблок HP с тонкими рамками. Встроенная веб-камера с шторкой приватности. Надёжное решение для дома и офиса.', 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&auto=format&fit=crop&q=80', 13),
('Моноблок HP ProOne 240 G10', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: черный
<!--/FEATURES-->
Бизнес-моноблок для офисов и организаций. Прочная сборка, быстрый процессор. Поддержка VESA-крепления для монтажа на стену.', 'https://hp-rus.com/upload/iblock/35d/p7hyec2xsalkh25wod4rzkjrrrmpkry7/bez-imeni_2_opt.webp', 14),

-- ═══ КОНДИЦИОНЕРЫ ═══
('ALMACOM ACH-12QS белый', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 12000 BTU/ч
Мощность охлаждения: 3500 Вт
Мощность обогрева: 3600 Вт
Обслуживаемая площадь: 35 кв.м
Класс энергоэффективности: A
Уровень шума: 42 дБ
Тип хладагента: R 410A
Габариты внутреннего блока: 822×295×198 мм
Габариты наружного блока: 780×545×285 мм
Вес внешнего блока: 27 кг
Код товара: 109703258
Цена: Цена по запросу
<!--/FEATURES-->
Настенная сплит-система ALMACOM ACH-12QS для охлаждения и обогрева помещений площадью до 35 кв.м. Поддерживает дополнительные режимы осушения воздуха, самоочистки и ночной режим. В комплекте монтажный набор, медная инсталляция, электрический кабель и пульт с подсветкой.', 'https://resources.cdn-kaspi.kz/img/m/p/p65/p33/49945993.jpg?format=gallery-medium', 15),
('Acron Plus CSH-07DR белый', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 7000 BTU/ч
Мощность охлаждения: 639 Вт
Обслуживаемая площадь: 21 кв.м
Класс энергоэффективности: A
Уровень шума: 38 дБ
Код товара: 161025159
Цена: Цена по запросу
<!--/FEATURES-->
Настенный кондиционер Acron Plus CSH-07DR для помещений площадью до 21 кв.м. В комплекте монтажный комплект, внутренний и наружный блоки, кронштейн, пульт ДУ, дренажный шланг.', 'https://resources.cdn-kaspi.kz/img/m/p/p30/p6f/131541654.png?format=gallery-medium', 16),
('Klima KAC-H07A4/FBR1', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 7000 BTU/ч
Мощность охлаждения: 2050 Вт
Потребляемая мощность при обогреве: 2200 Вт
Обслуживаемая площадь: 21 кв.м
Режим приточной вентиляции: Да
Класс энергоэффективности: A
Уровень шума: 48 дБ
Тип хладагента: R 32
Вес внутреннего блока: 6.5 кг
Вес внешнего блока: 20.5 кг
Код товара: 118462405
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Klima KAC-H07A4/FBR1 настенного типа. Оснащена режимом приточной вентиляции. В комплекте кондиционер, наружный блок, медная инсталляция, пульт ДУ, дренажный шланг и электрический кабель.', 'https://resources.cdn-kaspi.kz/img/m/p/p51/pd5/135263745.jpg?format=gallery-medium', 17),
('ALMACOM ACH-18QS белый', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 18000 BTU/ч
Мощность охлаждения: 5200 Вт
Мощность обогрева: 5250 Вт
Обслуживаемая площадь: 55 кв.м
Класс энергоэффективности: A
Уровень шума: 47 дБ
Тип хладагента: R 410A
Габариты внутреннего блока: 960x316x212 мм
Габариты наружного блока: 800x545x315 мм
Вес внешнего блока: 36 кг
Код товара: 109703283
Цена: Цена по запросу
<!--/FEATURES-->
Настенная сплит-система ALMACOM ACH-18QS класса A с официальной гарантией. Поддерживает дополнительные режимы самоочистки и авторестарта. Датчик I-Feel встроен в пульт. Комплектуется медной инсталляцией и кабелем.', 'https://resources.cdn-kaspi.kz/img/m/p/p15/p2a/35272717.jpg?format=gallery-medium', 18),
('Acron Plus CSH-09DO белый', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 9000 BTU/ч
Мощность охлаждения: 2600 Вт
Обслуживаемая площадь: 27 кв.м
Режим приточной вентиляции: Да
Режим осушения: Да
Класс энергоэффективности: A
Уровень шума: 38 дБ
Код товара: 137211893
Цена: Цена по запросу
<!--/FEATURES-->
Настенный кондиционер Acron Plus CSH-09DO с поддержкой режимов приточной вентиляции и осушения. Обслуживаемая площадь до 27 кв.м. В комплекте пульт дистанционного управления и таймер включения/выключения.', 'https://resources.cdn-kaspi.kz/img/m/p/pc3/p67/52451386.png?format=gallery-medium', 19),
('Klima KAC-H12A4/FBR1 белый', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Охлаждающая способность: 12000 BTU/ч
Мощность охлаждения: 3200 Вт
Потребляемая мощность при охлаждении: 3520 Вт
Потребляемая мощность при обогреве: 3665 Вт
Обслуживаемая площадь: 36 кв.м
Класс энергоэффективности: A
Уровень шума: 41 дБ
Тип хладагента: R 32
Габариты внутреннего блока: 777х250х201 мм
Габариты наружного блока: 777х290х498 мм
Вес внешнего блока: 25 кг
Код товара: 117088272
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Klima KAC-H12A4/FBR1 белого цвета. В комплекте внутренний и наружный блоки, медная инсталляция, пульт ДУ, дренажный шланг и электрический кабель.', 'https://resources.cdn-kaspi.kz/img/m/p/p66/pd8/135263752.jpg?format=gallery-medium', 20),

-- ═══ МОНОБЛОКИ ═══
('Моноблок Acer Aspire 23.8"', 'Моноблоки', '<!--FEATURES-->
Экран: 23.8" IPS, Full HD (1920 × 1080), матовый
Процессор: Intel Core i5-13420H (8 ядер, до 4.6 ГГц)
ОЗУ: 8 ГБ DDR4
Видеокарта: Intel UHD Graphics (встроенная)
Общая память: SSD M.2 NVMe 512 ГБ
ОС: Windows 11 Home
Габариты: вес ~3.4 кг, толщина корпуса ~18 мм
Цена: 490 000 тг
<!--/FEATURES-->
Надежный моноблок Acer Aspire с процессором 13-го поколения и матовым IPS экраном. Отличный выбор для дома и офиса.', 'https://www.regard.ru/api/site/cacheimg/goods/6417171/358', 30),
('Моноблок Lenovo ThinkCentre Neo 27"', 'Моноблоки', '<!--FEATURES-->
Экран: 27" IPS, Full HD (1920 × 1080), матовый, 100 Гц, 300 кд/м²
Процессор: Intel Core i7-13620H (10 ядер, 2.4–4.9 ГГц)
ОЗУ: 16 ГБ DDR5, 5200 МГц
Видеокарта: Intel UHD Graphics (встроенная)
Общая память: SSD PCIe NVMe 512 ГБ
Габариты: вес ~7.1 кг, Цвет: серый
Цена: 525 000 тг
<!--/FEATURES-->
Мощный и стильный 27-дюймовый моноблок с высокой частотой обновления экрана 100 Гц и быстрой памятью DDR5.', 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80', 31),
('Моноблок Lenovo Yoga 31.5"', 'Моноблоки', '<!--FEATURES-->
Экран: 31.5" IPS, UHD (3840 × 2160), матовый
Процессор: Intel Core i9-13900H (14 ядер, до 5.4 ГГц)
ОЗУ: 32 ГБ DDR5
Видеокарта: NVIDIA GeForce RTX 4050, 6 ГБ GDDR6
Общая память: SSD M.2 NVMe 1 ТБ
ОС: Windows 11 Home
Габариты: вес ~12 кг, толщина корпуса ~18 мм, Цвет: серый
Цена: 1 020 000 тг
<!--/FEATURES-->
Премиальный моноблок Lenovo Yoga с огромным 31.5-дюймовым UHD экраном, мощным процессором i9 и дискретной графикой.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', 32),
('Моноблок HP All-in-One 27"', 'Моноблоки', '<!--FEATURES-->
Экран: 27" IPS, Full HD (1920 × 1080), матовый
Процессор: Intel Core Ultra 5 (10 ядер, 1.3–4.8 ГГц)
ОЗУ: 16 ГБ DDR5
Видеокарта: Intel UHD Graphics (встроенная)
Общая память: SSD 512 ГБ
ОС: Без ОС
Габариты: вес ~6.7 кг, Цвет: чёрный
Цена: 500 000 тг
<!--/FEATURES-->
Современный моноблок на базе новейшего процессора Intel Core Ultra. Строгий черный дизайн.', 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80', 33),
('Моноблок HP EliteOne 23.8"', 'Моноблоки', '<!--FEATURES-->
Экран: 23.8" IPS, Full HD (1920 × 1080), антибликовый
Процессор: Intel Core i9-14900 (24 ядра, 2.0–5.5 ГГц)
ОЗУ: 32 ГБ DDR5
Видеокарта: Intel Arc Graphics (встроенная)
Общая память: SSD 1 ТБ
ОС: Windows
Габариты: корпус алюминий + пластик, вес ~7 кг, Цвет: чёрный
Цена: 1 980 000 тг
<!--/FEATURES-->
Флагманский моноблок HP EliteOne с 24-ядерным процессором. Идеальное решение для требовательных бизнес-задач.', 'https://hp-rus.com/upload/iblock/35d/p7hyec2xsalkh25wod4rzkjrrrmpkry7/bez-imeni_2_opt.webp', 34),
('Моноблок Lenovo IdeaCentre 23.8" (Ryzen 5)', 'Моноблоки', '<!--FEATURES-->
Экран: 23.8" IPS, Full HD (1920 × 1080), матовый
Процессор: AMD Ryzen 5 7430U (6 ядер, 2.3–4.3 ГГц)
ОЗУ: 16 ГБ DDR4
Видеокарта: AMD Radeon Graphics (встроенная)
Общая память: SSD M.2 NVMe 512 ГБ
Габариты: вес ~6.8 кг, корпус пластиковый
Комплектация: клавиатура и мышь в комплекте
Цена: 500 000 тг
<!--/FEATURES-->
Сбалансированный моноблок на базе AMD Ryzen 5 для дома и офиса. Периферия уже в комплекте.', 'https://www.technodom.kz/_next/image?url=https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_lenovo_ideacentre_aio_3_24ada6_white_a3050u_8_267322_1.jpg&w=3840&q=85', 35),
('Моноблок Lenovo IdeaCentre 23.8" (Intel N100)', 'Моноблоки', '<!--FEATURES-->
Экран: 23.8" IPS, Full HD (1920 × 1080), матовый
Процессор: Intel N100 (4-ядерный, 3.4 ГГц)
ОЗУ: 8 ГБ DDR5
Видеокарта: AMD Radeon Graphics (встроенная)
Общая память: SSD M.2 NVMe 512 ГБ
Габариты: вес ~6.8 кг, корпус пластиковый
Комплектация: клавиатура и мышь в комплекте
<!--/FEATURES-->
Доступный моноблок для базовых задач: учебы, работы с документами и серфинга в интернете.', 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&auto=format&fit=crop&q=80', 36),

-- ═══ ХОЛОДИЛЬНИКИ ═══
('Холодильник LG DoorCooling+ GA-B509MESL', 'Холодильники', '<!--FEATURES-->
Тип: Двухкамерный
Объем: 384 л (холодильная 277 л, морозильная 107 л)
Размораживание: Total No Frost
Инверторный компрессор: Да
Габариты: 203x59.5x68.2 см
Цвет: Серебристый
Цена: 349 990 тг
<!--/FEATURES-->
Вместительный холодильник LG с технологией DoorCooling+ для быстрого и равномерного охлаждения продуктов.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/1781681229566-rom62y.webp', 43),
('Холодильник Samsung RB34T670FSA/WT', 'Холодильники', '<!--FEATURES-->
Тип: Двухкамерный
Объем: 340 л
Размораживание: No Frost
Инверторный компрессор: Да (SpaceMax)
Габариты: 185.3x59.5x65.8 см
Цвет: Серебристый
Цена: 319 000 тг
<!--/FEATURES-->
Холодильник Samsung с увеличенным внутренним объемом за счет тонких стенок SpaceMax.', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80', 44),
('Холодильник Beko RCNK311E20VW', 'Холодильники', '<!--FEATURES-->
Тип: Двухкамерный
Объем: 276 л
Размораживание: No Frost (Dual Cooling)
Габариты: 184x54x60 см
Цвет: Белый
Цена: 179 990 тг
<!--/FEATURES-->
Компактный холодильник Beko с технологией двухконтурного охлаждения. Отличное решение для небольших кухонь.', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80', 45),

-- ═══ ТЕЛЕВИЗОРЫ ═══
('Телевизор Samsung 50" Crystal UHD 4K', 'Телевизоры', '<!--FEATURES-->
Модель: UE50CU7100UXCE
Диагональ: 50" (127 см)
Разрешение: 4K UHD (3840x2160)
Smart TV: Tizen
Звук: 20 Вт
Цена: 219 000 тг
<!--/FEATURES-->
Яркий и четкий 4K телевизор Samsung с процессором Crystal 4K и удобным Smart TV.', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&auto=format&fit=crop&q=80', 46),
('Телевизор LG 55" UHD 4K', 'Телевизоры', '<!--FEATURES-->
Модель: 55UR81006LJ
Диагональ: 55" (140 см)
Разрешение: 4K UHD (3840x2160)
Smart TV: webOS
Пульт: Magic Remote
Цена: 249 990 тг
<!--/FEATURES-->
Большой телевизор LG с поддержкой HDR10 Pro и удобным пультом-указкой Magic Remote.', 'https://images.unsplash.com/photo-1552975084-6e027cd345c2?w=600&auto=format&fit=crop&q=80', 47),
('Телевизор Xiaomi TV A2 43"', 'Телевизоры', '<!--FEATURES-->
Диагональ: 43" (109 см)
Разрешение: 4K UHD (3840x2160)
Smart TV: Android TV
Голосовое управление: Да
Цена: 129 000 тг
<!--/FEATURES-->
Доступный 4K телевизор от Xiaomi на базе Android TV с голосовым управлением и безрамочным дизайном.', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&auto=format&fit=crop&q=80', 48),

-- ═══ КОНДИЦИОНЕРЫ ═══
('ALMACOM ACH-07QR (Regular 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 18-20 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Авторестарт, золотое напыление на теплообменниках, IFEEL, режим сна, самоочистка, без инсталляции
Цена: Цена по запросу
<!--/FEATURES-->
Надежная сплит-система Almacom серии REGULAR 2025. Подходит для небольших помещений.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_8_ACH-09QR.png', 49),
('ALMACOM ACH-09QR (Regular 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 20-25 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Авторестарт, золотое напыление на теплообменниках, IFEEL, режим сна, самоочистка, без инсталляции
Цена: Цена по запросу
<!--/FEATURES-->
Надежная сплит-система Almacom серии REGULAR 2025 для помещений до 25 квадратных метров.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_8_ACH-09QR.png', 50),
('ALMACOM ACH-12QR (Regular 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 30-35 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Авторестарт, золотое напыление на теплообменниках, IFEEL, режим сна, самоочистка, без инсталляции
Цена: Цена по запросу
<!--/FEATURES-->
Надежная сплит-система Almacom серии REGULAR 2025. Мощное охлаждение для гостиных или офисов.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_8_ACH-09QR.png', 51),
('ALMACOM ACH-18QRA (Regular 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 50-55 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Авторестарт, золотое напыление на теплообменниках, IFEEL, режим сна, самоочистка, без инсталляции
Цена: Цена по запросу
<!--/FEATURES-->
Мощная сплит-система Almacom серии REGULAR 2025 для больших залов до 55 квадратных метров.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_8_ACH-09QR.png', 52),
('ALMACOM ACH-24QR (Regular 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 65-70 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Авторестарт, золотое напыление на теплообменниках, IFEEL, режим сна, самоочистка, без инсталляции
Цена: Цена по запросу
<!--/FEATURES-->
Мощная сплит-система Almacom серии REGULAR 2025 для больших залов до 70 квадратных метров.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_8_ACH-09QR.png', 53),
('ALMACOM ACH-07QR Wi-Fi (Regular 2026)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 18-20 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Wi-Fi, авторестарт, золотое напыление, IFEEL, режим сна, самоочистка
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Almacom REGULAR 2026 с поддержкой Wi-Fi управления с телефона.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_13_ACH-07QR_Wi-Fi_option.png', 54),
('ALMACOM ACH-09QR Wi-Fi (Regular 2026)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 20-25 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Wi-Fi, авторестарт, золотое напыление, IFEEL, режим сна, самоочистка
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Almacom REGULAR 2026 с поддержкой Wi-Fi управления с телефона.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_14_ACH-09QR_Wi-Fi_option.png', 55),
('ALMACOM ACH-12QR Wi-Fi (Regular 2026)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 30-35 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: Wi-Fi, авторестарт, золотое напыление, IFEEL, режим сна, самоочистка
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Almacom REGULAR 2026 с поддержкой Wi-Fi управления с телефона.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_14_ACH-09QR_Wi-Fi_option.png', 56),
('ALMACOM ACH-07QS (Standard 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 18-20 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: 3 метра медных труб (инсталляция) в комплекте
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Almacom серии STANDARD 2025 с инсталляцией в комплекте.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_17_ACH-07QS.png', 57),
('ALMACOM ACH-12QS (Standard 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 30-35 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: 3 метра медных труб (инсталляция) в комплекте
Цена: Цена по запросу
<!--/FEATURES-->
Сплит-система Almacom серии STANDARD 2025 с инсталляцией в комплекте. Идеально для комнат 30 м2.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_17_ACH-07QS.png', 58),
('ALMACOM ACH-18QSA (Standard 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 50-55 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: 3 метра медных труб (инсталляция) в комплекте
Цена: Цена по запросу
<!--/FEATURES-->
Мощная сплит-система Almacom серии STANDARD 2025 с инсталляцией в комплекте. Идеально для больших помещений 50 м2.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_17_ACH-07QS.png', 59),
('ALMACOM ACH-24QS (Standard 2025)', 'Кондиционеры', '<!--FEATURES-->
Тип: Сплит-система
Способ установки: Настенный
Обслуживаемая площадь: 65-70 м2
Класс энергоэффективности: A
Фреон: R410A
Гарантия: 36 месяцев
Особенности: 3 метра медных труб (инсталляция) в комплекте
Цена: Цена по запросу
<!--/FEATURES-->
Мощная сплит-система Almacom серии STANDARD 2025 с инсталляцией в комплекте. Идеально для коммерческих помещений 70 м2.', 'https://zeajipsclthtdmqdpahz.supabase.co/storage/v1/object/public/product-images/row_17_ACH-07QS.png', 60),

-- ═══ ИНТЕРАКТИВНЫЕ ПАНЕЛИ ═══
('Интерактивная панель Horion 65" 4K', 'Интерактивные панели', '<!--FEATURES-->
Диагональ: 65" (165 см)
Разрешение: 4K UHD (3840×2160)
Мультитач: 20 точек касания
ОС: Android / Windows OPS (опция)
Встроенный Wi-Fi, стилус в комплекте
<!--/FEATURES-->
Интерактивная панель Horion 65 дюймов для учебных классов, аудиторий и конференц-залов.', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80', 61),
('Интерактивная панель Newline 75" 4K Smartboard', 'Интерактивные панели', '<!--FEATURES-->
Диагональ: 75" (190 см)
Разрешение: 4K UHD (3840×2160)
Мультитач: 40 точек касания
Акустика: 2x20 Вт
Гарантия: 36 месяцев
<!--/FEATURES-->
Профессиональная интерактивная панель Newline 75 дюймов с антибликовым покрытием и поддержкой стилусов.', 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80', 62),
('Интерактивный комплект Hikvision 86"', 'Интерактивные панели', '<!--FEATURES-->
Диагональ: 86" (218 см)
Разрешение: 4K UHD (3840×2160)
Камера 4K и микрофонный массив в комплекте
ОС: Android 11 / OPS Windows 11
<!--/FEATURES-->
Флагманская интерактивная панель Hikvision 86 дюймов для переговорных комнат и онлайн-конференций.', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80', 63),

-- ═══ МЕБЕЛЬ ═══
('Офисное кресло эргономичное Nurset Ergonomic', 'Мебель', '<!--FEATURES-->
Материал: дышащая сетка + экокожа
Регулировки: высота, подголовник, подлокотники, поясничный упор
Максимальная нагрузка: до 130 кг
<!--/FEATURES-->
Эргономичное офисное кресло с высокой спинкой и анатомической поддержкой поясницы.', 'https://images.unsplash.com/photo-1580481072645-022f9a6d1270?w=600&auto=format&fit=crop&q=80', 64),
('Стол руководителя Nurset Executive', 'Мебель', '<!--FEATURES-->
Размеры: 1800×800×750 мм
Материал: ЛДСП 32 мм / металлокаркас
Цвет: Темный орех / Черный металл
<!--/FEATURES-->
Современный и солидный рабочий стол для кабинета руководителя или менеджера.', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80', 65),
('Шкаф архивный металлический для документов', 'Мебель', '<!--FEATURES-->
Размеры: 1850×920×450 мм
Замок: ключевой с ригельной системой
Количество полок: 4 регулируемые полки
<!--/FEATURES-->
Надежный металлический шкаф для хранения документов и офисных бумаг.', 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&auto=format&fit=crop&q=80', 66);