-- Nurset database schema and RLS policies.
-- Note: supabase/migrations contains the authoritative, ordered migration history.
-- This file is kept in sync with the final secure database schema.

-- 1. Tables

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  options JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(options) = 'array'
    AND NOT jsonb_path_exists(options, '$[*] ? (@.type() != "string")')
  ),
  is_filterable BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  external_id TEXT,
  slug TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  name_ru TEXT,
  name_kk TEXT,
  short_description_ru TEXT,
  short_description_kk TEXT,
  description_ru TEXT,
  description_kk TEXT,
  price_mode TEXT NOT NULL DEFAULT 'request',
  price_amount NUMERIC(14, 2),
  old_price_amount NUMERIC(14, 2),
  currency CHAR(3) NOT NULL DEFAULT 'KZT',
  stock_status TEXT NOT NULL DEFAULT 'unknown',
  warranty_ru TEXT,
  warranty_kk TEXT,
  publication_status TEXT NOT NULL DEFAULT 'draft',
  publish_ru BOOLEAN NOT NULL DEFAULT false,
  publish_kk BOOLEAN NOT NULL DEFAULT false,
  translation_status_kk TEXT NOT NULL DEFAULT 'missing',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT,
  source_reference TEXT,
  source_hash TEXT,
  seo_title_ru TEXT,
  seo_title_kk TEXT,
  seo_description_ru TEXT,
  seo_description_kk TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT,
  source_url TEXT,
  alt_ru TEXT,
  alt_kk TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  UNIQUE(product_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_message TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  organization TEXT,
  bin TEXT,
  city TEXT,
  customer_message TEXT,
  locale TEXT NOT NULL DEFAULT 'ru',
  consent_personal_data BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  source_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  internal_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  snapshot_sku TEXT,
  snapshot_name TEXT NOT NULL,
  snapshot_category_name TEXT,
  snapshot_brand_name TEXT,
  snapshot_price_mode TEXT,
  snapshot_price_amount NUMERIC(14, 2),
  snapshot_currency CHAR(3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged',
  summary JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  source_row JSONB NOT NULL,
  normalized_payload JSONB,
  matched_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  proposed_action TEXT NOT NULL,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, row_number)
);

CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL DEFAULT 'product-images',
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT storage_cleanup_processing_lease_check CHECK (
    (status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_cleanup_queue_active_path
  ON public.storage_cleanup_queue (bucket, storage_path)
  WHERE status IN ('pending', 'processing');

-- 2. RLS Enablement

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- 3. Functions & Helper RPCs

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

CREATE OR REPLACE FUNCTION public.is_product_published(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = p_product_id
      AND publication_status = 'published'
      AND (publish_ru OR (publish_kk AND translation_status_kk = 'verified'))
  );
$$;

REVOKE ALL ON FUNCTION public.is_product_published(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_product_published(UUID) TO anon, authenticated;

-- 4. Triggers

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_brands_updated_at ON public.brands;
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_attributes_updated_at ON public.attributes;
CREATE TRIGGER trg_attributes_updated_at BEFORE UPDATE ON public.attributes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_attribute_values_updated_at ON public.product_attribute_values;
CREATE TRIGGER trg_product_attribute_values_updated_at BEFORE UPDATE ON public.product_attribute_values FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_images_updated_at ON public.product_images;
CREATE TRIGGER trg_product_images_updated_at BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Policies

DROP POLICY IF EXISTS "Public read access for products" ON public.products;
DROP POLICY IF EXISTS "Public read published products" ON public.products;
DROP POLICY IF EXISTS "Admins read products" ON public.products;
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
DROP POLICY IF EXISTS "Admins update products" ON public.products;
DROP POLICY IF EXISTS "Admins delete products" ON public.products;

CREATE POLICY "Admins read products" ON public.products FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins read product images" ON public.product_images;
CREATE POLICY "Admins read product images" ON public.product_images FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins read product attribute values" ON public.product_attribute_values;
CREATE POLICY "Admins read product attribute values" ON public.product_attribute_values FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;

REVOKE INSERT ON public.orders FROM PUBLIC, anon, authenticated;
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage quote requests" ON public.quote_requests;
CREATE POLICY "Admins manage quote requests" ON public.quote_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage quote request items" ON public.quote_request_items;
CREATE POLICY "Admins manage quote request items" ON public.quote_request_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage storage cleanup queue" ON public.storage_cleanup_queue;
CREATE POLICY "Admins manage storage cleanup queue" ON public.storage_cleanup_queue FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Views

CREATE OR REPLACE VIEW public.public_products AS
SELECT
  p.id,
  p.slug,
  p.sku,
  p.category_id,
  p.brand_id,
  CASE WHEN p.publish_ru THEN p.name_ru ELSE NULL END AS name_ru,
  CASE WHEN (p.publish_kk AND p.translation_status_kk = 'verified') THEN p.name_kk ELSE NULL END AS name_kk,
  CASE WHEN p.publish_ru THEN p.short_description_ru ELSE NULL END AS short_description_ru,
  CASE WHEN (p.publish_kk AND p.translation_status_kk = 'verified') THEN p.short_description_kk ELSE NULL END AS short_description_kk,
  CASE WHEN p.publish_ru THEN p.description_ru ELSE NULL END AS description_ru,
  CASE WHEN (p.publish_kk AND p.translation_status_kk = 'verified') THEN p.description_kk ELSE NULL END AS description_kk,
  CASE WHEN p.publish_ru THEN p.warranty_ru ELSE NULL END AS warranty_ru,
  CASE WHEN (p.publish_kk AND p.translation_status_kk = 'verified') THEN p.warranty_kk ELSE NULL END AS warranty_kk,
  p.price_mode,
  CASE WHEN p.price_mode IN ('exact', 'from') THEN p.price_amount ELSE NULL END AS price_amount,
  CASE WHEN p.price_mode IN ('exact', 'from') THEN p.old_price_amount ELSE NULL END AS old_price_amount,
  p.currency,
  p.stock_status,
  p.image_url,
  p.is_featured,
  p.sort_order,
  p.created_at
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
WHERE p.publication_status = 'published'
  AND c.status = 'published'
  AND (p.publish_ru OR (p.publish_kk AND p.translation_status_kk = 'verified'));

REVOKE ALL ON public.public_products FROM PUBLIC;
GRANT SELECT ON public.public_products TO anon, authenticated;

-- 7. Application RPCs

CREATE OR REPLACE FUNCTION public.get_published_product_slug(
  p_locale TEXT,
  p_id UUID
)
RETURNS TABLE (id UUID, slug TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.slug
  FROM public.products p
  JOIN public.categories c ON c.id = p.category_id
  WHERE p.id = p_id
    AND p.publication_status = 'published'
    AND c.status = 'published'
    AND p.currency = 'KZT'
    AND p.slug IS NOT NULL
    AND (
      (p_locale = 'ru' AND p.publish_ru AND p.name_ru IS NOT NULL AND p.name_ru <> '')
      OR
      (p_locale = 'kk' AND p.publish_kk AND p.translation_status_kk = 'verified' AND p.name_kk IS NOT NULL AND p.name_kk <> '')
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_product_slug(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_product_slug(TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_published_product_detail(
  p_locale TEXT,
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_result JSONB;
BEGIN
  IF p_locale NOT IN ('ru', 'kk') THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', p.id,
    'slug', p.slug,
    'sku', p.sku,
    'category_id', p.category_id,
    'brand_id', p.brand_id,
    'name_ru', CASE WHEN p_locale = 'ru' THEN p.name_ru ELSE NULL END,
    'name_kk', CASE WHEN p_locale = 'kk' THEN p.name_kk ELSE NULL END,
    'short_description_ru', CASE WHEN p_locale = 'ru' THEN p.short_description_ru ELSE NULL END,
    'short_description_kk', CASE WHEN p_locale = 'kk' THEN p.short_description_kk ELSE NULL END,
    'description_ru', CASE WHEN p_locale = 'ru' THEN p.description_ru ELSE NULL END,
    'description_kk', CASE WHEN p_locale = 'kk' THEN p.description_kk ELSE NULL END,
    'warranty_ru', CASE WHEN p_locale = 'ru' THEN p.warranty_ru ELSE NULL END,
    'warranty_kk', CASE WHEN p_locale = 'kk' THEN p.warranty_kk ELSE NULL END,
    'price_mode', p.price_mode,
    'price_amount', CASE WHEN p.price_mode IN ('exact', 'from') THEN p.price_amount ELSE NULL END,
    'old_price_amount', CASE WHEN p.price_mode IN ('exact', 'from') THEN p.old_price_amount ELSE NULL END,
    'currency', p.currency,
    'stock_status', p.stock_status,
    'image_url', p.image_url,
    'is_featured', p.is_featured,
    'sort_order', p.sort_order,
    'created_at', p.created_at,
    'category', json_build_object(
      'id', c.id,
      'slug', c.slug,
      'name_ru', CASE WHEN p_locale = 'ru' THEN c.name_ru ELSE NULL END,
      'name_kk', CASE WHEN p_locale = 'kk' THEN c.name_kk ELSE NULL END
    ),
    'brand', CASE WHEN b.id IS NOT NULL THEN json_build_object(
      'id', b.id,
      'slug', b.slug,
      'name', b.name,
      'logo_url', b.logo_url
    ) ELSE NULL END,
    'product_images', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', pi.id,
          'source_url', pi.source_url,
          'storage_path', pi.storage_path,
          'alt_ru', CASE WHEN p_locale = 'ru' THEN pi.alt_ru ELSE NULL END,
          'alt_kk', CASE WHEN p_locale = 'kk' THEN pi.alt_kk ELSE NULL END,
          'sort_order', pi.sort_order,
          'is_primary', pi.is_primary
        ) ORDER BY pi.sort_order ASC, pi.created_at ASC
      ), '[]'::json)
      FROM public.product_images pi
      WHERE pi.product_id = p.id
    ),
    'product_attribute_values', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', pav.id,
          'value_text_ru', CASE WHEN p_locale = 'ru' THEN pav.value_text_ru ELSE NULL END,
          'value_text_kk', CASE WHEN p_locale = 'kk' THEN pav.value_text_kk ELSE NULL END,
          'value_number', pav.value_number,
          'value_boolean', pav.value_boolean,
          'value_option', pav.value_option,
          'attribute', json_build_object(
            'id', a.id,
            'code', a.code,
            'name_ru', CASE WHEN p_locale = 'ru' THEN a.name_ru ELSE NULL END,
            'name_kk', CASE WHEN p_locale = 'kk' THEN a.name_kk ELSE NULL END,
            'unit_ru', CASE WHEN p_locale = 'ru' THEN a.unit_ru ELSE NULL END,
            'unit_kk', CASE WHEN p_locale = 'kk' THEN a.unit_kk ELSE NULL END,
            'sort_order', a.sort_order
          )
        ) ORDER BY a.sort_order ASC
      ), '[]'::json)
      FROM public.product_attribute_values pav
      JOIN public.attributes a ON a.id = pav.attribute_id
      WHERE pav.product_id = p.id AND a.status = 'published'
    )
  ) INTO v_result
  FROM public.products p
  JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN public.brands b ON b.id = p.brand_id AND b.status = 'published'
  WHERE p.slug = p_slug
    AND p.publication_status = 'published'
    AND c.status = 'published'
    AND p.currency = 'KZT'
    AND (
      (p_locale = 'ru' AND p.publish_ru = true AND p.name_ru IS NOT NULL AND p.name_ru <> '')
      OR
      (p_locale = 'kk' AND p.publish_kk = true AND p.translation_status_kk = 'verified' AND p.name_kk IS NOT NULL AND p.name_kk <> '')
    )
  LIMIT 1;

  RETURN v_result;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_published_product_detail(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_product_detail(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_published_product_ids_by_attributes(
  p_locale TEXT,
  p_filters JSONB
)
RETURNS TABLE (product_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_code TEXT;
  v_raw_value TEXT;
  v_attribute RECORD;
  v_matches UUID[] := NULL;
  v_current UUID[];
BEGIN
  IF p_locale NOT IN ('ru', 'kk') THEN
    RAISE EXCEPTION 'locale must be ru or kk' USING ERRCODE = '22023';
  END IF;

  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'object' THEN
    RAISE EXCEPTION 'filters must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF jsonb_object_length(p_filters) = 0 THEN
    RETURN;
  END IF;

  IF jsonb_object_length(p_filters) > 20 THEN
    RAISE EXCEPTION 'too many attribute filters' USING ERRCODE = '22023';
  END IF;

  FOR v_code, v_raw_value IN
    SELECT key, value
    FROM jsonb_each_text(p_filters)
    ORDER BY key
  LOOP
    IF v_raw_value IS NULL OR btrim(v_raw_value) = '' OR length(v_raw_value) > 120 THEN
      RAISE EXCEPTION 'invalid value for attribute %', v_code USING ERRCODE = '22023';
    END IF;

    SELECT a.id, a.data_type
    INTO v_attribute
    FROM public.attributes a
    WHERE a.code = v_code
      AND a.status = 'published'
      AND a.is_filterable = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'attribute % is not a published filter', v_code USING ERRCODE = '22023';
    END IF;

    IF v_attribute.data_type = 'boolean' AND v_raw_value NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'attribute % must be true or false', v_code USING ERRCODE = '22023';
    END IF;

    IF v_attribute.data_type = 'number' AND v_raw_value !~ '^\d+(\.\d{1,4})?$' THEN
      RAISE EXCEPTION 'attribute % must be a non-negative number', v_code USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(array_agg(matches.product_id), ARRAY[]::UUID[])
    INTO v_current
    FROM (
      SELECT pav.product_id
      FROM public.product_attribute_values pav
      JOIN public.products p ON p.id = pav.product_id
      JOIN public.categories c ON c.id = p.category_id
      WHERE pav.attribute_id = v_attribute.id
        AND p.publication_status = 'published'
        AND c.status = 'published'
        AND p.currency = 'KZT'
        AND (
          (p_locale = 'ru' AND p.publish_ru = true AND NULLIF(p.name_ru, '') IS NOT NULL)
          OR
          (p_locale = 'kk' AND p.publish_kk = true AND p.translation_status_kk = 'verified' AND NULLIF(p.name_kk, '') IS NOT NULL)
        )
        AND CASE v_attribute.data_type
          WHEN 'boolean' THEN pav.value_boolean = (v_raw_value = 'true')
          WHEN 'number' THEN pav.value_number = v_raw_value::NUMERIC
          WHEN 'option' THEN pav.value_option = v_raw_value
          WHEN 'text' THEN CASE
            WHEN p_locale = 'kk' THEN pav.value_text_kk = v_raw_value
            ELSE pav.value_text_ru = v_raw_value
          END
          ELSE false
        END
      ORDER BY pav.product_id
      LIMIT 5001
    ) AS matches;

    IF cardinality(v_current) > 5000 THEN
      RAISE EXCEPTION 'catalog attribute filter is too broad' USING ERRCODE = '54000';
    END IF;

    IF v_matches IS NULL THEN
      v_matches := v_current;
    ELSE
      SELECT COALESCE(array_agg(candidate), ARRAY[]::UUID[])
      INTO v_matches
      FROM unnest(v_matches) AS candidate
      WHERE candidate = ANY(v_current);
    END IF;

    EXIT WHEN cardinality(v_matches) = 0;
  END LOOP;

  RETURN QUERY
  SELECT candidate
  FROM unnest(COALESCE(v_matches, ARRAY[]::UUID[])) AS candidate
  ORDER BY candidate;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_published_product_ids_by_attributes(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_product_ids_by_attributes(TEXT, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_cms_product_attributes(
  p_product_id UUID,
  p_product_data JSONB,
  p_attributes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_attr JSONB;
  v_db_attr RECORD;
  v_opt TEXT;
  v_allowed BOOLEAN;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id FOR UPDATE) THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.products
  SET
    name = COALESCE(p_product_data->>'name', name),
    category = COALESCE(p_product_data->>'category', category),
    description = p_product_data->>'description',
    sort_order = COALESCE((p_product_data->>'sort_order')::INTEGER, sort_order),
    sku = NULLIF(p_product_data->>'sku', ''),
    external_id = NULLIF(p_product_data->>'external_id', ''),
    slug = NULLIF(p_product_data->>'slug', ''),
    category_id = (p_product_data->>'category_id')::UUID,
    brand_id = (p_product_data->>'brand_id')::UUID,
    name_ru = p_product_data->>'name_ru',
    name_kk = NULLIF(p_product_data->>'name_kk', ''),
    short_description_ru = NULLIF(p_product_data->>'short_description_ru', ''),
    short_description_kk = NULLIF(p_product_data->>'short_description_kk', ''),
    description_ru = NULLIF(p_product_data->>'description_ru', ''),
    description_kk = NULLIF(p_product_data->>'description_kk', ''),
    warranty_ru = NULLIF(p_product_data->>'warranty_ru', ''),
    warranty_kk = NULLIF(p_product_data->>'warranty_kk', ''),
    price_mode = p_product_data->>'price_mode',
    price_amount = NULLIF(p_product_data->>'price_amount', '')::NUMERIC,
    old_price_amount = NULLIF(p_product_data->>'old_price_amount', '')::NUMERIC,
    currency = COALESCE(p_product_data->>'currency', 'KZT'),
    stock_status = p_product_data->>'stock_status',
    publication_status = p_product_data->>'publication_status',
    publish_ru = COALESCE((p_product_data->>'publish_ru')::BOOLEAN, false),
    publish_kk = COALESCE((p_product_data->>'publish_kk')::BOOLEAN, false),
    translation_status_kk = p_product_data->>'translation_status_kk',
    is_featured = COALESCE((p_product_data->>'is_featured')::BOOLEAN, false),
    seo_title_ru = NULLIF(p_product_data->>'seo_title_ru', ''),
    seo_title_kk = NULLIF(p_product_data->>'seo_title_kk', ''),
    seo_description_ru = NULLIF(p_product_data->>'seo_description_ru', ''),
    seo_description_kk = NULLIF(p_product_data->>'seo_description_kk', ''),
    updated_at = now()
  WHERE id = p_product_id;

  IF p_attributes IS NOT NULL THEN
    DELETE FROM public.product_attribute_values
    WHERE product_id = p_product_id;

    IF jsonb_array_length(p_attributes) > 0 THEN
      FOR v_attr IN SELECT * FROM jsonb_array_elements(p_attributes)
      LOOP
        SELECT id, data_type, options, status INTO v_db_attr FROM public.attributes WHERE id = (v_attr->>'attribute_id')::UUID;
        IF v_db_attr IS NULL THEN
          RAISE EXCEPTION 'attribute % not found', v_attr->>'attribute_id' USING ERRCODE = '23503';
        END IF;

        IF v_db_attr.status != 'published' THEN
          RAISE EXCEPTION 'attribute % is not published', v_attr->>'attribute_id' USING ERRCODE = '23503';
        END IF;

        IF v_db_attr.data_type = 'boolean' AND v_attr->>'value_boolean' IS NOT NULL AND jsonb_typeof(v_attr->'value_boolean') != 'boolean' THEN
          RAISE EXCEPTION 'attribute % boolean value must be boolean', v_attr->>'attribute_id' USING ERRCODE = '22023';
        ELSIF v_db_attr.data_type = 'option' AND NULLIF(v_attr->>'value_option', '') IS NOT NULL THEN
          IF v_db_attr.options IS NULL OR jsonb_array_length(v_db_attr.options) = 0 THEN
             RAISE EXCEPTION 'attribute % option requires options configuration', v_attr->>'attribute_id' USING ERRCODE = '22023';
          END IF;
          v_allowed := false;
          FOR v_opt IN SELECT jsonb_array_elements_text(v_db_attr.options)
          LOOP
            IF v_opt = v_attr->>'value_option' THEN
               v_allowed := true;
               EXIT;
            END IF;
          END LOOP;
          IF NOT v_allowed THEN
             RAISE EXCEPTION 'attribute % value_option is not in allowed options', v_attr->>'attribute_id' USING ERRCODE = '22023';
          END IF;
        END IF;

        INSERT INTO public.product_attribute_values (
          product_id,
          attribute_id,
          value_text_ru,
          value_text_kk,
          value_number,
          value_boolean,
          value_option,
          raw_value
        ) VALUES (
          p_product_id,
          (v_attr->>'attribute_id')::UUID,
          CASE WHEN v_db_attr.data_type = 'text' THEN NULLIF(v_attr->>'value_text_ru', '') ELSE NULL END,
          CASE WHEN v_db_attr.data_type = 'text' THEN NULLIF(v_attr->>'value_text_kk', '') ELSE NULL END,
          CASE WHEN v_db_attr.data_type = 'number' THEN NULLIF(v_attr->>'value_number', '')::NUMERIC ELSE NULL END,
          CASE WHEN v_db_attr.data_type = 'boolean' THEN (v_attr->>'value_boolean')::BOOLEAN ELSE NULL END,
          CASE WHEN v_db_attr.data_type = 'option' THEN NULLIF(v_attr->>'value_option', '') ELSE NULL END,
          NULLIF(v_attr->>'raw_value', '')
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_product_id);
END;
$func$;

REVOKE ALL ON FUNCTION public.save_cms_product_attributes(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_cms_product_attributes(UUID, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_storage_cleanup(p_bucket TEXT, p_storage_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_job_id UUID;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_bucket IS DISTINCT FROM 'product-images'
    OR p_storage_path IS NULL
    OR btrim(p_storage_path) = ''
    OR length(p_storage_path) > 1024
    OR p_storage_path LIKE '/%'
    OR p_storage_path LIKE '%..%'
    OR strpos(p_storage_path, E'\\') > 0 THEN
    RAISE EXCEPTION 'invalid storage cleanup target' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.storage_cleanup_queue (bucket, storage_path)
  VALUES ('product-images', p_storage_path)
  ON CONFLICT (bucket, storage_path) WHERE status IN ('pending', 'processing')
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.enqueue_storage_cleanup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_storage_cleanup(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_storage_cleanup_jobs(
  p_limit INTEGER DEFAULT 50,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  bucket TEXT,
  storage_path TEXT,
  attempts INTEGER,
  lease_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_lease_token UUID := gen_random_uuid();
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_lease_seconds INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 30), 1800);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id
    FROM public.storage_cleanup_queue AS queue
    WHERE queue.attempts < 5
      AND (
        (queue.status IN ('pending', 'failed') AND queue.next_attempt_at <= now())
        OR
        (queue.status = 'processing' AND queue.lease_expires_at <= now())
      )
    ORDER BY queue.created_at ASC, queue.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  ), claimed AS (
    UPDATE public.storage_cleanup_queue AS queue
    SET
      status = 'processing',
      lease_token = v_lease_token,
      lease_expires_at = now() + make_interval(secs => v_lease_seconds),
      updated_at = now()
    FROM candidates
    WHERE queue.id = candidates.id
    RETURNING queue.id, queue.bucket, queue.storage_path, queue.attempts, queue.lease_token
  )
  SELECT claimed.id, claimed.bucket, claimed.storage_path, claimed.attempts, claimed.lease_token
  FROM claimed
  ORDER BY claimed.id;
END;
$func$;

REVOKE ALL ON FUNCTION public.claim_storage_cleanup_jobs(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_storage_cleanup_jobs(INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_product_primary_image_invariant(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_primary_count INT;
  v_next_primary_id UUID;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_primary_count
  FROM public.product_images
  WHERE product_id = p_product_id AND is_primary = true;

  IF v_primary_count = 0 THEN
    SELECT id INTO v_next_primary_id
    FROM public.product_images
    WHERE product_id = p_product_id
    ORDER BY sort_order ASC, created_at ASC, id ASC
    LIMIT 1;

    IF v_next_primary_id IS NOT NULL THEN
      UPDATE public.product_images
      SET is_primary = true, updated_at = now()
      WHERE id = v_next_primary_id;
    END IF;
  ELSIF v_primary_count > 1 THEN
    SELECT id INTO v_next_primary_id
    FROM public.product_images
    WHERE product_id = p_product_id AND is_primary = true
    ORDER BY sort_order ASC, created_at ASC, id ASC
    LIMIT 1;

    UPDATE public.product_images
    SET is_primary = (id = v_next_primary_id), updated_at = now()
    WHERE product_id = p_product_id;
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.ensure_product_primary_image_invariant(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_product_primary_image_invariant(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_primary_product_image(
  p_product_id UUID,
  p_image_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_images WHERE id = p_image_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.product_images
  SET is_primary = false, updated_at = now()
  WHERE product_id = p_product_id AND is_primary = true AND id <> p_image_id;

  UPDATE public.product_images
  SET is_primary = true, updated_at = now()
  WHERE id = p_image_id AND product_id = p_product_id;

  RETURN jsonb_build_object('success', true, 'product_id', p_product_id, 'primary_image_id', p_image_id);
END;
$func$;

REVOKE ALL ON FUNCTION public.set_primary_product_image(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_product_image(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_product_images(
  p_product_id UUID,
  p_image_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id UUID;
  v_idx INT := 0;
  v_db_count INT;
  v_param_count INT;
  v_distinct_count INT;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;

  IF p_image_ids IS NULL THEN
    RAISE EXCEPTION 'image_ids cannot be null' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_db_count
  FROM public.product_images
  WHERE product_id = p_product_id;

  v_param_count := array_length(p_image_ids, 1);
  IF v_param_count IS NULL THEN v_param_count := 0; END IF;

  SELECT count(DISTINCT unnest) INTO v_distinct_count
  FROM unnest(p_image_ids);

  IF v_param_count <> v_db_count OR v_distinct_count <> v_db_count THEN
    RAISE EXCEPTION 'image_ids must contain a unique complete list of gallery IDs for the product' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_image_ids) AS item_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_images
      WHERE id = item_id AND product_id = p_product_id
    )
  ) THEN
    RAISE EXCEPTION 'image_ids contains IDs from another product or non-existent IDs' USING ERRCODE = '22023';
  END IF;

  FOREACH v_id IN ARRAY p_image_ids
  LOOP
    UPDATE public.product_images
    SET sort_order = v_idx, updated_at = now()
    WHERE id = v_id AND product_id = p_product_id;
    v_idx := v_idx + 1;
  END LOOP;

  PERFORM public.ensure_product_primary_image_invariant(p_product_id);

  RETURN jsonb_build_object('success', true, 'product_id', p_product_id, 'count', v_idx);
END;
$func$;

REVOKE ALL ON FUNCTION public.reorder_product_images(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_product_images(UUID, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_product_image(
  p_product_id UUID,
  p_image_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id UUID;
  v_is_primary BOOLEAN;
  v_db_count INT;
  v_req_primary BOOLEAN;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;

  SELECT count(*) INTO v_db_count FROM public.product_images WHERE product_id = p_product_id;

  v_req_primary := COALESCE((p_image_data->>'is_primary')::BOOLEAN, false);
  v_is_primary := (v_db_count = 0) OR v_req_primary;

  IF v_is_primary AND v_db_count > 0 THEN
    UPDATE public.product_images
    SET is_primary = false, updated_at = now()
    WHERE product_id = p_product_id AND is_primary = true;
  END IF;

  INSERT INTO public.product_images (
    product_id,
    storage_path,
    source_url,
    alt_ru,
    alt_kk,
    sort_order,
    is_primary
  ) VALUES (
    p_product_id,
    p_image_data->>'storage_path',
    p_image_data->>'source_url',
    p_image_data->>'alt_ru',
    p_image_data->>'alt_kk',
    COALESCE((p_image_data->>'sort_order')::INT, 0),
    v_is_primary
  )
  RETURNING id INTO v_id;

  PERFORM public.ensure_product_primary_image_invariant(p_product_id);

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'product_id', p_product_id,
    'storage_path', p_image_data->>'storage_path',
    'source_url', p_image_data->>'source_url',
    'alt_ru', p_image_data->>'alt_ru',
    'alt_kk', p_image_data->>'alt_kk',
    'sort_order', COALESCE((p_image_data->>'sort_order')::INT, 0),
    'is_primary', v_is_primary
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.create_product_image(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_product_image(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_product_image(
  p_product_id UUID,
  p_image_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_storage_path TEXT;
  v_source_url TEXT;
  v_job_id UUID := NULL;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;

  SELECT storage_path, source_url INTO v_storage_path, v_source_url
  FROM public.product_images
  WHERE id = p_image_id AND product_id = p_product_id;

  IF v_storage_path IS NULL AND v_source_url IS NULL THEN
    RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_storage_path IS NOT NULL AND v_storage_path <> '' THEN
    INSERT INTO public.storage_cleanup_queue (bucket, storage_path)
    VALUES ('product-images', v_storage_path)
    ON CONFLICT (bucket, storage_path) WHERE status IN ('pending', 'processing')
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_job_id;
  END IF;

  DELETE FROM public.product_images WHERE id = p_image_id AND product_id = p_product_id;

  PERFORM public.ensure_product_primary_image_invariant(p_product_id);

  RETURN jsonb_build_object(
    'success', true,
    'id', p_image_id,
    'product_id', p_product_id,
    'storage_path', v_storage_path,
    'source_url', v_source_url,
    'cleanup_job_id', v_job_id
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.delete_product_image(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product_image(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_import_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_batch public.import_batches%ROWTYPE;
  v_row public.import_rows%ROWTYPE;
  v_payload JSONB;
  v_category_id UUID;
  v_brand_id UUID;
  v_category_name TEXT;
  v_product_id UUID;
  v_created INTEGER := 0;
  v_updated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_result JSONB;
  v_error TEXT;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT * INTO v_batch
    FROM public.import_batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'import batch not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_batch.status = 'completed' THEN
      RETURN COALESCE(v_batch.summary, '{}'::jsonb) || jsonb_build_object('status', 'completed', 'idempotent', true);
    END IF;

    IF v_batch.status NOT IN ('approved', 'failed') THEN
      RAISE EXCEPTION 'import batch is not approved for apply' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.import_batches
    SET status = 'applying'
    WHERE id = p_batch_id;

    FOR v_row IN
      SELECT * FROM public.import_rows
      WHERE batch_id = p_batch_id
      ORDER BY row_number
      FOR UPDATE
    LOOP
      IF v_row.proposed_action = 'error' THEN
        RAISE EXCEPTION 'batch contains invalid import rows' USING ERRCODE = '22023';
      END IF;

      IF v_row.proposed_action = 'skip' THEN
        UPDATE public.import_rows SET status = 'skipped', updated_at = now() WHERE id = v_row.id;
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_payload := v_row.normalized_payload;
      IF v_payload IS NULL THEN
        RAISE EXCEPTION 'validated row has no normalized payload' USING ERRCODE = '22023';
      END IF;

      v_category_id := NULL;
      v_category_name := NULL;
      SELECT id, name_ru INTO v_category_id, v_category_name
      FROM public.categories
      WHERE slug = v_payload->>'category_slug'
        AND status <> 'archived'
      LIMIT 1;
      IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'category not found for import row %', v_row.row_number USING ERRCODE = '23503';
      END IF;

      v_brand_id := NULL;
      IF NULLIF(v_payload->>'brand_slug', '') IS NOT NULL THEN
        SELECT id INTO v_brand_id
        FROM public.brands
        WHERE slug = v_payload->>'brand_slug'
          AND status <> 'archived'
        LIMIT 1;
        IF v_brand_id IS NULL THEN
          RAISE EXCEPTION 'brand not found for import row %', v_row.row_number USING ERRCODE = '23503';
        END IF;
      END IF;

      v_product_id := v_row.matched_product_id;
      IF v_row.proposed_action = 'update' AND v_product_id IS NULL THEN
        SELECT p.id INTO v_product_id
        FROM public.products p
        WHERE (NULLIF(v_payload->>'sku', '') IS NOT NULL AND p.sku = v_payload->>'sku')
           OR (
             NULLIF(v_payload->>'external_id', '') IS NOT NULL
             AND p.external_id = v_payload->>'external_id'
             AND p.source_type = v_payload->>'source_type'
             AND COALESCE(p.source_reference, '') = COALESCE(v_payload->>'source_reference', '')
           )
        LIMIT 1;
      END IF;

      IF v_row.proposed_action = 'create' THEN
        IF NULLIF(v_payload->>'sku', '') IS NULL THEN
          RAISE EXCEPTION 'new import row % has no SKU' , v_row.row_number USING ERRCODE = '23514';
        END IF;
        INSERT INTO public.products (
          name, category, description, image_url, sort_order,
          sku, external_id, slug, category_id, brand_id,
          name_ru, name_kk, short_description_ru, short_description_kk,
          description_ru, description_kk, price_mode, price_amount, old_price_amount,
          currency, stock_status, publication_status, publish_ru, publish_kk,
          translation_status_kk, is_featured, source_type, source_reference, source_hash
        ) VALUES (
          v_payload->>'name_ru', v_category_name, v_payload->>'description_ru', v_payload->>'image_url', 0,
          NULLIF(v_payload->>'sku', ''), NULLIF(v_payload->>'external_id', ''), NULLIF(v_payload->>'slug', ''), v_category_id, v_brand_id,
          v_payload->>'name_ru', NULLIF(v_payload->>'name_kk', ''), NULLIF(v_payload->>'short_description_ru', ''), NULLIF(v_payload->>'short_description_kk', ''),
          NULLIF(v_payload->>'description_ru', ''), NULLIF(v_payload->>'description_kk', ''), v_payload->>'price_mode',
          NULLIF(v_payload->>'price_amount', '')::NUMERIC, NULLIF(v_payload->>'old_price_amount', '')::NUMERIC,
          'KZT', v_payload->>'stock_status', 'draft', false, false,
          v_payload->>'translation_status_kk', COALESCE((v_payload->>'is_featured')::BOOLEAN, false),
          v_payload->>'source_type', NULLIF(v_payload->>'source_reference', ''), v_payload->>'source_hash'
        ) RETURNING id INTO v_product_id;
        v_created := v_created + 1;
      ELSE
        IF v_product_id IS NULL THEN
          RAISE EXCEPTION 'matching product disappeared for import row %', v_row.row_number USING ERRCODE = '23503';
        END IF;
        UPDATE public.products
        SET name = v_payload->>'name_ru',
            category = v_category_name,
            description = v_payload->>'description_ru',
            image_url = NULLIF(v_payload->>'image_url', ''),
            sku = NULLIF(v_payload->>'sku', ''),
            external_id = NULLIF(v_payload->>'external_id', ''),
            slug = NULLIF(v_payload->>'slug', ''),
            category_id = v_category_id,
            brand_id = v_brand_id,
            name_ru = v_payload->>'name_ru',
            name_kk = NULLIF(v_payload->>'name_kk', ''),
            short_description_ru = NULLIF(v_payload->>'short_description_ru', ''),
            short_description_kk = NULLIF(v_payload->>'short_description_kk', ''),
            description_ru = NULLIF(v_payload->>'description_ru', ''),
            description_kk = NULLIF(v_payload->>'description_kk', ''),
            price_mode = v_payload->>'price_mode',
            price_amount = NULLIF(v_payload->>'price_amount', '')::NUMERIC,
            old_price_amount = NULLIF(v_payload->>'old_price_amount', '')::NUMERIC,
            currency = 'KZT',
            stock_status = v_payload->>'stock_status',
            publication_status = CASE WHEN v_payload->>'publication_status' = 'published' THEN 'draft' ELSE v_payload->>'publication_status' END,
            publish_ru = COALESCE((v_payload->>'publish_ru')::BOOLEAN, false),
            publish_kk = COALESCE((v_payload->>'publish_kk')::BOOLEAN, false),
            translation_status_kk = v_payload->>'translation_status_kk',
            is_featured = COALESCE((v_payload->>'is_featured')::BOOLEAN, false),
            source_type = v_payload->>'source_type',
            source_reference = NULLIF(v_payload->>'source_reference', ''),
            source_hash = v_payload->>'source_hash',
            updated_at = now()
        WHERE id = v_product_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'matching product disappeared for import row %', v_row.row_number USING ERRCODE = '23503';
        END IF;
        v_updated := v_updated + 1;
      END IF;

      UPDATE public.import_rows
      SET matched_product_id = v_product_id, status = 'applied', updated_at = now()
      WHERE id = v_row.id;
    END LOOP;

    v_result := jsonb_build_object(
      'status', 'completed', 'idempotent', false, 'created', v_created,
      'updated', v_updated, 'skipped', v_skipped, 'source_hash', v_batch.source_hash
    );
    UPDATE public.import_batches
    SET status = 'completed', applied_at = now(), summary = COALESCE(summary, '{}'::jsonb) || v_result
    WHERE id = p_batch_id;
    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE;
    END IF;
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    UPDATE public.import_rows
    SET status = 'failed', updated_at = now()
    WHERE batch_id = p_batch_id AND status NOT IN ('applied', 'skipped');
    UPDATE public.import_batches
    SET status = 'failed', summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object('status', 'failed', 'error', 'apply failed', 'error_code', SQLSTATE)
    WHERE id = p_batch_id;
    RETURN jsonb_build_object('status', 'failed', 'error', 'apply failed', 'error_code', SQLSTATE);
  END;
END;
$func$;

REVOKE ALL ON FUNCTION public.apply_import_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import_batch(UUID) TO authenticated;
