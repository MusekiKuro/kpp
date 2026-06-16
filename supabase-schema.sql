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

-- ═══ НОУТБУКИ (доступные модели) ═══
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
Универсальный ноутбук для работы и учёбы. Мощный процессор 13-го поколения, быстрый SSD на 512 ГБ.', 'https://images.unsplash.com/photo-1496181130204-7552cc14bac4?w=600&auto=format&fit=crop&q=80', 2),

('Ноутбук Lenovo IdeaPad 1 15AMN7', 'Ноутбуки', '<!--FEATURES-->
Процессор: AMD Ryzen 3 7320U
RAM: 8 ГБ LPDDR5
SSD: 256 ГБ NVMe
Дисплей: 15.6" TN 1920×1080
Графика: AMD Radeon 610M
ОС: без ОС
Вес: 1.58 кг
<!--/FEATURES-->
Самый доступный ноутбук в линейке. Идеален для простых задач: документы, интернет, мессенджеры.', 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&auto=format&fit=crop&q=80', 3),

('Ноутбук Acer Aspire 3 A315-44P', 'Ноутбуки', '<!--FEATURES-->
Процессор: AMD Ryzen 5 5625U (6 ядер)
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: AMD Radeon Graphics
ОС: без ОС
Вес: 1.78 кг
<!--/FEATURES-->
Надёжный ноутбук для повседневных задач. Процессор AMD Ryzen 5 для офисных приложений и многозадачности.', 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80', 4),

('Ноутбук Acer Aspire 5 A515-58M', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U (10 ядер)
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.76 кг
<!--/FEATURES-->
Производительный ноутбук с 16 ГБ RAM. Графика Intel Iris Xe для лёгкой обработки фото и видео.', 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&auto=format&fit=crop&q=80', 5),

('Ноутбук HP 15s-fq5000', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U (6 ядер)
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Вес: 1.69 кг
<!--/FEATURES-->
Доступный ноутбук HP для дома и офиса. Тихая работа и хороший экран.', 'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=600&auto=format&fit=crop&q=80', 6),

('Ноутбук HP 250 G10', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U (10 ядер)
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.74 кг
<!--/FEATURES-->
Бизнес-ноутбук для офиса и учёбы. Надёжная сборка HP, быстрый процессор и вместительный SSD.', 'https://images.unsplash.com/photo-1606312619070-d48b4c644a0b?w=600&auto=format&fit=crop&q=80', 7),

('Ноутбук Acer Aspire Lite AL15-52', 'Ноутбуки', '<!--FEATURES-->
Процессор: Intel Core i5-1235U (10 ядер)
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 15.6" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Вес: 1.59 кг
<!--/FEATURES-->
Тонкий и лёгкий ноутбук с большим объёмом памяти. Металлический корпус, узкие рамки экрана.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80', 8),

-- ═══ МОНОБЛОКИ (доступные модели) ═══
('Моноблок Lenovo IdeaCentre AIO 3 24IAP7', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: белый
<!--/FEATURES-->
Доступный моноблок для дома и офиса. IPS-экран с хорошими углами обзора. Всё необходимое в одном устройстве.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', 9),

('Моноблок Lenovo IdeaCentre AIO 3 27IAP7', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1235U
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 27" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: черный
<!--/FEATURES-->
Большой 27-дюймовый моноблок для продуктивной работы. Встроенные динамики и веб-камера.', 'https://images.unsplash.com/photo-1618392138305-0e920e45f5c2?w=600&auto=format&fit=crop&q=80', 10),

('Моноблок Acer Aspire C24-1800', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1305U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: серебристый
<!--/FEATURES-->
Компактный моноблок Acer с тонким корпусом. Беспроводная мышь и клавиатура в комплекте.', 'https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf?w=600&auto=format&fit=crop&q=80', 11),

('Моноблок Acer Aspire C27-1800', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U
RAM: 16 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 27" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: серебристый
<!--/FEATURES-->
Производительный моноблок с большим 27-дюймовым экраном. 16 ГБ RAM, Wi-Fi 6 и Bluetooth 5.2.', 'https://images.unsplash.com/photo-1609262772830-0decc49ec18c?w=600&auto=format&fit=crop&q=80', 12),

('Моноблок HP All-in-One 24-cb1038ci', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i3-1215U
RAM: 8 ГБ DDR4
SSD: 256 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel UHD Graphics
ОС: без ОС
Цвет: белый
<!--/FEATURES-->
Стильный моноблок HP с тонкими рамками. Веб-камера с шторкой приватности.', 'https://images.unsplash.com/photo-1629429407759-01cd3d7cfb38?w=600&auto=format&fit=crop&q=80', 13),

('Моноблок HP ProOne 240 G10', 'Моноблоки', '<!--FEATURES-->
Процессор: Intel Core i5-1335U
RAM: 8 ГБ DDR4
SSD: 512 ГБ NVMe
Дисплей: 23.8" IPS 1920×1080
Графика: Intel Iris Xe
ОС: без ОС
Цвет: черный
<!--/FEATURES-->
Бизнес-моноблок для офисов. Прочная сборка, поддержка VESA-крепления для монтажа на стену.', 'https://images.unsplash.com/photo-1587440871875-7974c9d44a48?w=600&auto=format&fit=crop&q=80', 14),

-- ═══ КОНДИЦИОНЕРЫ (народные бренды) ═══
('Кондиционер Midea MSAG-09HRN8', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 2.64 кВт (9000 BTU)
Тип: on/off
Хладагент: R32
Уровень шума: 32 дБ
Класс: A
Площадь: до 25 м²
Режимы: охлаждение, обогрев, осушение, вентиляция
<!--/FEATURES-->
Популярная сплит-система Midea. Самоочистка, авторестарт, ночной режим. Фильтр высокой плотности.', 'https://images.unsplash.com/photo-1631596644034-9d5b6b6a6e5b?w=600&auto=format&fit=crop&q=80', 15),

('Кондиционер Midea MSAG-12HRN8', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 3.52 кВт (12000 BTU)
Тип: on/off
Хладагент: R32
Уровень шума: 34 дБ
Класс: A
Площадь: до 35 м²
Режимы: охлаждение, обогрев, осушение, вентиляция
<!--/FEATURES-->
Надёжная сплит-система для средних помещений. Турборежим, скрытый LED-дисплей.', 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&auto=format&fit=crop&q=80', 16),

('Кондиционер Midea AF8-09N1C2-I (инвертор)', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 2.64 кВт (9000 BTU)
Тип: инвертор
Wi-Fi: да
Хладагент: R32
Уровень шума: 24 дБ
Класс: A++
Площадь: до 27 м²
Golden Fin: антикоррозийное покрытие
<!--/FEATURES-->
Инверторная сплит-система с Wi-Fi. Антикоррозийное покрытие Golden Fin. Тихая работа — 24 дБ.', 'https://images.unsplash.com/photo-1615263552830-86d8d14c6e0b?w=600&auto=format&fit=crop&q=80', 17),

('Кондиционер Artel ART-09HG', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 2.6 кВт (9000 BTU)
Тип: on/off
Хладагент: R410A
Уровень шума: 33 дБ
Класс: A
Площадь: до 20 м²
Режимы: охлаждение, обогрев, осушение, вентиляция
<!--/FEATURES-->
Бюджетная сплит-система Artel. Адаптирована к нестабильному напряжению. Турборежим, таймер, авторестарт.', 'https://images.unsplash.com/photo-1601579112592-7ef01a3e74b2?w=600&auto=format&fit=crop&q=80', 18),

('Кондиционер Artel ART-12HS', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 3.5 кВт (12000 BTU)
Тип: on/off
Хладагент: R410A
Уровень шума: 35 дБ
Класс: A
Площадь: до 36 м²
Режимы: охлаждение, обогрев, осушение, вентиляция
<!--/FEATURES-->
Мощная сплит-система для средних и больших комнат. Надёжный компрессор, ночной режим.', 'https://images.unsplash.com/photo-1581578711379-8e4a4c6c0a0c?w=600&auto=format&fit=crop&q=80', 19),

('Кондиционер Almacom ACH-09AS', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 2.73 кВт (9000 BTU)
Мощность обогрева: 2.85 кВт
Хладагент: R410A
Уровень шума: 30 дБ
Класс: A
Площадь: до 25 м²
I-Feel сенсор: да
<!--/FEATURES-->
Казахстанский бренд. Технология I-Feel — датчик в пульте. Самоочистка, медная инсталляция в комплекте.', 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=600&auto=format&fit=crop&q=80', 20),

('Кондиционер Almacom ACH-12AS', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 3.52 кВт (12000 BTU)
Мощность обогрева: 3.81 кВт
Хладагент: R410A
Уровень шума: 32 дБ
Класс: A
Площадь: до 35 м²
Антикоррозийный корпус: да
<!--/FEATURES-->
Надёжная сплит-система Almacom. Антикоррозийный корпус, защита от холодного воздуха. Медная инсталляция в комплекте.', 'https://images.unsplash.com/photo-1599249540218-6d848d6d5259?w=600&auto=format&fit=crop&q=80', 21),

('Кондиционер Oasis OT-09', 'Кондиционеры', '<!--FEATURES-->
Мощность охлаждения: 2.64 кВт (9000 BTU)
Мощность обогрева: 2.78 кВт
Хладагент: R410A
Уровень шума: 32 дБ
Класс: A
Площадь: до 26 м²
Гарантия: 3 года
<!--/FEATURES-->
Бюджетная сплит-система с хорошим соотношением цены и качества. Авторестарт, ночной режим, таймер. Гарантия 3 года.', 'https://images.unsplash.com/photo-1625245488600-f03fef636a3c?w=600&auto=format&fit=crop&q=80', 22),

-- ═══ МЕБЕЛЬ ═══
('Кресло офисное Brabix Smart MG-313', 'Мебель', '<!--FEATURES-->
Материал: сетка/ткань
Регулировка высоты: газлифт
Подлокотники: нет
Max нагрузка: 120 кг
Цвет: черный
Размер: 42×43×86 см
<!--/FEATURES-->
Эргономичное офисное кресло с дышащей сеткой. Доступная цена и надёжность для ежедневной работы.', 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&auto=format&fit=crop&q=80', 23),

('Кресло офисное Brabix Spring MG-307', 'Мебель', '<!--FEATURES-->
Материал: сетка/ткань
Регулировка высоты: газлифт
Подлокотники: 3D регулируемые
Механизм качания: да
Max нагрузка: 120 кг
Цвет: черный
Размер: 55×49×101 см
<!--/FEATURES-->
Комфортное кресло с 3D-подлокотниками и механизмом качания. Поясничный упор и дышащая сетка.', 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&auto=format&fit=crop&q=80', 24),

('Кресло компьютерное Brabix Dexter GM-135', 'Мебель', '<!--FEATURES-->
Материал: экокожа/сетка
Регулировка высоты: газлифт
Подлокотники: 3D
Выдвижная подножка: да
Подушки: поясничная + шейная
Max нагрузка: 150 кг
Размер: 61×121 см
<!--/FEATURES-->
Премиальное кресло с выдвижной подножкой и ортопедическими подушками.', 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=600&auto=format&fit=crop&q=80', 25),

('Стол компьютерный Felix Office 120', 'Мебель', '<!--FEATURES-->
Размер: 120×60×75 см
Материал: ЛДСП E1
Цвет: дуб сонома / белый
Нагрузка: до 80 кг
Толщина столешницы: 22 мм
<!--/FEATURES-->
Практичный компьютерный стол для дома и офиса. Лаконичный дизайн, прочная ЛДСП E1.', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80', 26),

('Стол угловой Felix Corner 140', 'Мебель', '<!--FEATURES-->
Размер: 140×140×75 см
Материал: ЛДСП E1
Цвет: дуб сонома / черный
Нагрузка: до 100 кг
Толщина столешницы: 25 мм
<!--/FEATURES-->
Угловой стол для эффективного использования пространства. Подходит для home-office.', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&auto=format&fit=crop&q=80', 27),

('Шкаф для документов Cuba 800', 'Мебель', '<!--FEATURES-->
Размер: 800×400×2000 мм
Материал: ЛДСП 16 мм
Полки: 4 регулируемых
Дверцы: распашные
Цвет: дуб сонома / белый
<!--/FEATURES-->
Вместительный шкаф для документов с четырьмя регулируемыми полками. Надёжное хранение.', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&auto=format&fit=crop&q=80', 28),

('Шкаф для одежды Cuba 1000', 'Мебель', '<!--FEATURES-->
Размер: 1000×500×2000 мм
Материал: ЛДСП 18 мм
Полки: 3 + штанга для вешалок
Дверцы: распашные с замком
Цвет: венге / дуб сонома
<!--/FEATURES-->
Просторный шкаф для одежды с штангой и тремя полками. Замок на дверцах для сохранности.', 'https://images.unsplash.com/photo-1597006335772-2ba2e1b1a397?w=600&auto=format&fit=crop&q=80', 29);
