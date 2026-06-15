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

-- 6. Начальные данные
INSERT INTO products (name, category, description, image_url, sort_order) VALUES
  ('Смартфон Xiaomi Redmi 13C', 'Смартфоны', '6.74", 4/128 ГБ, 5000 мАч — надёжный бюджетник', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80', 1),
  ('Смартфон Samsung Galaxy A55', 'Смартфоны', '6.6" Super AMOLED, 8/128 ГБ, 5000 мАч', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80', 2),
  ('Смартфон Apple iPhone 15 Pro', 'Смартфоны', '6.1" OLED, A17 Pro, 128 ГБ, титановый корпус', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80', 3),
  ('Ноутбук Lenovo IdeaPad 3', 'Ноутбуки', '15.6" FHD, Intel i5, 8/256 SSD — для учёбы и работы', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80', 4),
  ('Ноутбук ASUS VivoBook Pro', 'Ноутбуки', '15.6" OLED, Ryzen 7, 16/512 SSD, RTX 3050', 'https://images.unsplash.com/photo-1496181130204-7552cc14bac4?w=600&auto=format&fit=crop&q=80', 5),
  ('Телевизор Samsung 43" 4K', 'Телевизоры', '43" Crystal UHD, Smart TV, HDR10+', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&auto=format&fit=crop&q=80', 6),
  ('Телевизор LG 55" OLED', 'Телевизоры', '55" 4K OLED, webOS, Dolby Vision & Atmos', 'https://images.unsplash.com/photo-1552975084-6e027cd345c2?w=600&auto=format&fit=crop&q=80', 7),
  ('Холодильник Samsung RT-38', 'Бытовая техника', '385 л, No Frost, инверторный компрессор', 'https://images.unsplash.com/photo-1571175432230-0190d154e577?w=600&auto=format&fit=crop&q=80', 8),
  ('Стиральная машина LG F2V3', 'Бытовая техника', '7 кг, 1200 об/мин, паровая стирка Steam', 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&auto=format&fit=crop&q=80', 9),
  ('Пылесос Dyson V12 Detect', 'Бытовая техника', 'Беспроводной, лазерная подсветка, 60 мин', 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80', 10),
  ('Офисный стол ERGOLINE', 'Мебель', '120×60 см, ЛДСП, регулируемые ножки, белый', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80', 11),
  ('Кресло офисное COMFORT Pro', 'Мебель', 'Сетка, регулируемые подлокотники, поясничная поддержка', 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&auto=format&fit=crop&q=80', 12),
  ('Наушники Apple AirPods Pro 2', 'Аксессуары', 'ANC, адаптивный звук, до 30 ч с кейсом', 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=600&auto=format&fit=crop&q=80', 13),
  ('Чехол-книжка Samsung Galaxy', 'Аксессуары', 'Экокожа, магнитная застёжка, кармашек для карт', 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80', 14),
  ('Кондиционер LG Artcool 09', 'Кондиционеры', '<!--FEATURES-->\nМощность: 2.5 кВт\nТип: инвертор\nWi-Fi: да\nУровень шума: 19 дБ\nКласс: A+++\n<!--/FEATURES-->\nСовременный кондиционер с инверторным управлением, низким уровнем шума и встроенным Wi-Fi модулем. Идеален для квартир до 25 м².', 'https://images.unsplash.com/photo-1631596644034-9d5b6b6a6e5b?w=600&auto=format&fit=crop&q=80', 15),
  ('Кондиционер Daikin Perfera', 'Кондиционеры', '<!--FEATURES-->\nМощность: 3.5 кВт\nFlash Streamer: да\nCoanda: да\nУровень шума: 19 дБ\nКласс: A+++\n<!--/FEATURES-->\nЯпонское качество, технология Flash Streamer очищает воздух, а режим Coanda предотвращает сквозняки. Для помещений до 35 м².', 'https://images.unsplash.com/photo-1615263552830-86d8d14c6e0b?w=600&auto=format&fit=crop&q=80', 16),
  ('Кондиционер Mitsubishi MSZ-LN', 'Кондиционеры', '<!--FEATURES-->\nМощность: 2.5 кВт\nPlasma Quad Plus: да\n3D i-see Sensor: да\nТип: инвертор\n<!--/FEATURES-->\nПремиальный кондиционер с плазменным очистителем и 3D-датчиком, который сканирует температуру по всему помещению.', 'https://images.unsplash.com/photo-1581578711379-8e4a4c6c0a0c?w=600&auto=format&fit=crop&q=80', 17),
  ('Кондиционер Ballu Olympio Edge', 'Кондиционеры', '<!--FEATURES-->\nМощность: 2.6 кВт\nИонизатор: да\nWi-Fi: да\nУровень шума: 21 дБ\nКласс: A++\n<!--/FEATURES-->\nДоступная цена при отличных характеристиках: ионизация воздуха, Wi-Fi управление и низкий уровень шума.', 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=600&auto=format&fit=crop&q=80', 18);
