-- T02: additive catalog domain, import staging, quote requests, and RLS.
-- Apply only after a verified backup and staging rehearsal.
-- This migration preserves legacy products/orders tables and all legacy columns.

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  name_kk TEXT,
  description_ru TEXT,
  description_kk TEXT,
  seo_title_ru TEXT,
  seo_title_kk TEXT,
  seo_description_ru TEXT,
  seo_description_kk TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT categories_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT categories_sort_order_check
    CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description_ru TEXT,
  description_kk TEXT,
  logo_url TEXT,
  website_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brands_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT brands_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT brands_sort_order_check
    CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS public.attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  name_kk TEXT,
  data_type TEXT NOT NULL,
  unit_ru TEXT,
  unit_kk TEXT,
  is_filterable BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attributes_code_format_check
    CHECK (code ~ '^[a-z0-9][a-z0-9_]*$'),
  CONSTRAINT attributes_data_type_check
    CHECK (data_type IN ('text', 'number', 'boolean', 'option')),
  CONSTRAINT attributes_sort_order_check
    CHECK (sort_order >= 0)
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name_ru TEXT,
  ADD COLUMN IF NOT EXISTS name_kk TEXT,
  ADD COLUMN IF NOT EXISTS short_description_ru TEXT,
  ADD COLUMN IF NOT EXISTS short_description_kk TEXT,
  ADD COLUMN IF NOT EXISTS description_ru TEXT,
  ADD COLUMN IF NOT EXISTS description_kk TEXT,
  ADD COLUMN IF NOT EXISTS price_mode TEXT NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS old_price_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'KZT',
  ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS warranty_ru TEXT,
  ADD COLUMN IF NOT EXISTS warranty_kk TEXT,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS publish_ru BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_kk BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translation_status_kk TEXT NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sku_format_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sku_format_check
      CHECK (sku IS NULL OR sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_slug_format_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_slug_format_check
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_price_mode_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_mode_check
      CHECK (price_mode IN ('request', 'exact', 'from', 'hidden'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_price_amount_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_amount_check
      CHECK (
        (price_mode IN ('exact', 'from') AND price_amount IS NOT NULL AND price_amount > 0)
        OR
        (price_mode IN ('request', 'hidden') AND (price_amount IS NULL OR price_amount > 0))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_old_price_amount_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_old_price_amount_check
      CHECK (
        old_price_amount IS NULL
        OR (price_amount IS NOT NULL AND old_price_amount > price_amount)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_currency_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_currency_check CHECK (currency = 'KZT');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_status_check
      CHECK (stock_status IN ('unknown', 'in_stock', 'on_order', 'out_of_stock'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_publication_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_publication_status_check
      CHECK (publication_status IN ('draft', 'published', 'archived'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_translation_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_translation_status_check
      CHECK (translation_status_kk IN ('missing', 'ai_draft', 'verified'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_publish_kk_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_publish_kk_check
      CHECK (NOT publish_kk OR translation_status_kk = 'verified');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_idx
  ON public.products (sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_idx
  ON public.products (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_category_publication_idx
  ON public.products (category_id, publication_status, sort_order);

CREATE INDEX IF NOT EXISTS products_brand_publication_idx
  ON public.products (brand_id, publication_status);

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  source_url TEXT,
  alt_ru TEXT,
  alt_kk TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_images_storage_path_check CHECK (btrim(storage_path) <> ''),
  CONSTRAINT product_images_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT product_images_product_path_unique UNIQUE (product_id, storage_path)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_idx
  ON public.product_images (product_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
  ON public.product_images (product_id, sort_order, id);

CREATE TABLE IF NOT EXISTS public.product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  value_text_ru TEXT,
  value_text_kk TEXT,
  value_number NUMERIC(14, 4),
  value_boolean BOOLEAN,
  value_option TEXT,
  raw_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_attribute_values_pair_unique UNIQUE (product_id, attribute_id),
  CONSTRAINT product_attribute_values_typed_value_check
    CHECK (num_nonnulls(value_number, value_boolean, value_option) <= 1)
);

CREATE INDEX IF NOT EXISTS product_attribute_values_attribute_idx
  ON public.product_attribute_values (attribute_id, product_id);

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_filename TEXT,
  source_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  CONSTRAINT import_batches_source_type_check
    CHECK (source_type IN ('xlsx', 'csv', 'json', 'text_agent')),
  CONSTRAINT import_batches_status_check
    CHECK (status IN ('uploaded', 'parsed', 'needs_review', 'approved', 'applying', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS import_batches_status_created_idx
  ON public.import_batches (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  matched_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  proposed_action TEXT NOT NULL DEFAULT 'error',
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_rows_batch_row_unique UNIQUE (batch_id, row_number),
  CONSTRAINT import_rows_row_number_check CHECK (row_number > 0),
  CONSTRAINT import_rows_action_check
    CHECK (proposed_action IN ('create', 'update', 'skip', 'error')),
  CONSTRAINT import_rows_status_check
    CHECK (status IN ('pending', 'validated', 'needs_review', 'applied', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS import_rows_batch_status_idx
  ON public.import_rows (batch_id, status, row_number);

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  organization TEXT,
  bin TEXT,
  city TEXT,
  customer_message TEXT,
  locale TEXT NOT NULL,
  consent_personal_data BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  internal_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quote_requests_locale_check CHECK (locale IN ('ru', 'kk')),
  CONSTRAINT quote_requests_consent_check CHECK (consent_personal_data IS TRUE),
  CONSTRAINT quote_requests_status_check
    CHECK (status IN ('new', 'contacted', 'in_progress', 'closed', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.quote_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sku_snapshot TEXT,
  name_snapshot TEXT NOT NULL,
  image_url_snapshot TEXT,
  price_mode_snapshot TEXT NOT NULL,
  price_amount_snapshot NUMERIC(14, 2),
  currency_snapshot CHAR(3) NOT NULL DEFAULT 'KZT',
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT quote_request_items_quantity_check CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT quote_request_items_name_check CHECK (btrim(name_snapshot) <> ''),
  CONSTRAINT quote_request_items_price_mode_check
    CHECK (price_mode_snapshot IN ('request', 'exact', 'from', 'hidden')),
  CONSTRAINT quote_request_items_price_check
    CHECK (
      (price_mode_snapshot IN ('exact', 'from') AND price_amount_snapshot IS NOT NULL AND price_amount_snapshot > 0)
      OR
      (price_mode_snapshot IN ('request', 'hidden') AND (price_amount_snapshot IS NULL OR price_amount_snapshot > 0))
    ),
  CONSTRAINT quote_request_items_currency_check CHECK (currency_snapshot = 'KZT'),
  CONSTRAINT quote_request_items_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS quote_requests_status_created_idx
  ON public.quote_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS quote_request_items_request_sort_idx
  ON public.quote_request_items (quote_request_id, sort_order, id);

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

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for products" ON public.products;
DROP POLICY IF EXISTS "Public read published products" ON public.products;
DROP POLICY IF EXISTS "Authenticated insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated delete products" ON public.products;
DROP POLICY IF EXISTS "Admins read products" ON public.products;
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
DROP POLICY IF EXISTS "Admins update products" ON public.products;
DROP POLICY IF EXISTS "Admins delete products" ON public.products;

CREATE POLICY "Public read published products"
  ON public.products FOR SELECT
  TO public
  USING (publication_status = 'published' AND (publish_ru OR publish_kk));

CREATE POLICY "Admins read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Admins read categories" ON public.categories;
DROP POLICY IF EXISTS "Admins insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins delete categories" ON public.categories;

CREATE POLICY "Public read categories"
  ON public.categories FOR SELECT TO public
  USING (status = 'published');
CREATE POLICY "Admins read categories"
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read brands" ON public.brands;
DROP POLICY IF EXISTS "Admins read brands" ON public.brands;
DROP POLICY IF EXISTS "Admins insert brands" ON public.brands;
DROP POLICY IF EXISTS "Admins update brands" ON public.brands;
DROP POLICY IF EXISTS "Admins delete brands" ON public.brands;

CREATE POLICY "Public read brands"
  ON public.brands FOR SELECT TO public
  USING (status = 'published');
CREATE POLICY "Admins read brands"
  ON public.brands FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert brands"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update brands"
  ON public.brands FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete brands"
  ON public.brands FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins read product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins update product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins delete product images" ON public.product_images;

CREATE POLICY "Public read product images"
  ON public.product_images FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.publication_status = 'published'
        AND (p.publish_ru OR p.publish_kk)
    )
  );
CREATE POLICY "Admins read product images"
  ON public.product_images FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert product images"
  ON public.product_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update product images"
  ON public.product_images FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete product images"
  ON public.product_images FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read attributes" ON public.attributes;
DROP POLICY IF EXISTS "Admins read attributes" ON public.attributes;
DROP POLICY IF EXISTS "Admins insert attributes" ON public.attributes;
DROP POLICY IF EXISTS "Admins update attributes" ON public.attributes;
DROP POLICY IF EXISTS "Admins delete attributes" ON public.attributes;

CREATE POLICY "Public read attributes"
  ON public.attributes FOR SELECT TO public
  USING (
    category_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id AND c.status = 'published'
    )
  );
CREATE POLICY "Admins read attributes"
  ON public.attributes FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert attributes"
  ON public.attributes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update attributes"
  ON public.attributes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete attributes"
  ON public.attributes FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins read product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins insert product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins update product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins delete product attribute values" ON public.product_attribute_values;

CREATE POLICY "Public read product attribute values"
  ON public.product_attribute_values FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.publication_status = 'published'
        AND (p.publish_ru OR p.publish_kk)
    )
  );
CREATE POLICY "Admins read product attribute values"
  ON public.product_attribute_values FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert product attribute values"
  ON public.product_attribute_values FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update product attribute values"
  ON public.product_attribute_values FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete product attribute values"
  ON public.product_attribute_values FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read import batches" ON public.import_batches;
DROP POLICY IF EXISTS "Admins insert import batches" ON public.import_batches;
DROP POLICY IF EXISTS "Admins update import batches" ON public.import_batches;
DROP POLICY IF EXISTS "Admins delete import batches" ON public.import_batches;

CREATE POLICY "Admins read import batches"
  ON public.import_batches FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert import batches"
  ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());
CREATE POLICY "Admins update import batches"
  ON public.import_batches FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete import batches"
  ON public.import_batches FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read import rows" ON public.import_rows;
DROP POLICY IF EXISTS "Admins insert import rows" ON public.import_rows;
DROP POLICY IF EXISTS "Admins update import rows" ON public.import_rows;
DROP POLICY IF EXISTS "Admins delete import rows" ON public.import_rows;

CREATE POLICY "Admins read import rows"
  ON public.import_rows FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert import rows"
  ON public.import_rows FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update import rows"
  ON public.import_rows FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete import rows"
  ON public.import_rows FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Admins insert quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Admins update quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Admins delete quote requests" ON public.quote_requests;

CREATE POLICY "Admins read quote requests"
  ON public.quote_requests FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert quote requests"
  ON public.quote_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update quote requests"
  ON public.quote_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete quote requests"
  ON public.quote_requests FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read quote request items" ON public.quote_request_items;
DROP POLICY IF EXISTS "Admins insert quote request items" ON public.quote_request_items;
DROP POLICY IF EXISTS "Admins update quote request items" ON public.quote_request_items;
DROP POLICY IF EXISTS "Admins delete quote request items" ON public.quote_request_items;

CREATE POLICY "Admins read quote request items"
  ON public.quote_request_items FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins insert quote request items"
  ON public.quote_request_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins update quote request items"
  ON public.quote_request_items FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete quote request items"
  ON public.quote_request_items FOR DELETE TO authenticated
  USING (public.is_admin());

-- Rollback/recovery is documented in docs/T02_MIGRATION_ROLLBACK.md.
