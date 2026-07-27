-- Apply this migration to an existing Supabase project before running seed-products.sql.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS products_name_category_key
  ON public.products (name, category);

CREATE INDEX IF NOT EXISTS products_category_sort_order_idx
  ON public.products (category, sort_order);

CREATE INDEX IF NOT EXISTS orders_created_at_status_idx
  ON public.orders (created_at DESC, status);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Public read access for products" ON public.products;
DROP POLICY IF EXISTS "Authenticated insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated delete products" ON public.products;
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
DROP POLICY IF EXISTS "Admins update products" ON public.products;
DROP POLICY IF EXISTS "Admins delete products" ON public.products;

CREATE POLICY "Public read access for products"
  ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Admins insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete products"
  ON public.products FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;

CREATE POLICY "Public insert orders"
  ON public.orders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins read orders"
  ON public.orders FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete orders"
  ON public.orders FOR DELETE TO authenticated USING (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');
CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
