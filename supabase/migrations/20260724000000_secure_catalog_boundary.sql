-- T13 / F02: Secure public catalog boundary, RLS isolation, and published product lookup.
-- 1. Revoke direct anon SELECT on public.products table to prevent leaking internal fields
--    (external_id, source_reference, source_hash, unpublished locales, cost prices when price_mode='request').
-- 2. Expose public catalog exclusively through a secure, column-restricted SECURITY DEFINER view public.public_products.
-- 3. Provide SECURITY DEFINER helper public.is_product_published for child table RLS policies (product_images, product_attribute_values).
-- 4. Provide SECURITY DEFINER RPC public.get_published_product_slug for legacy UUID redirects.

DROP POLICY IF EXISTS "Public read access for products" ON public.products;
DROP POLICY IF EXISTS "Public read published products" ON public.products;
DROP POLICY IF EXISTS "Admins read products" ON public.products;

-- Create policy allowing ONLY admins to read base products table directly
CREATE POLICY "Admins read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- SECURITY DEFINER helper function to check if a product is published for public child RLS
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

-- Update child RLS policies on product_images and product_attribute_values to restrict to admins
DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins read product images" ON public.product_images;
CREATE POLICY "Admins read product images"
  ON public.product_images FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product attribute values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Admins read product attribute values" ON public.product_attribute_values;
CREATE POLICY "Admins read product attribute values"
  ON public.product_attribute_values FOR SELECT TO authenticated
  USING (public.is_admin());

-- Secure public view containing ONLY safe, public-facing columns (internal fields & unpublished locales stripped)
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

-- SECURITY DEFINER RPC to look up published product id/slug for legacy UUID redirects
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

-- SECURITY DEFINER RPC for getting safe product detail with strict locale isolation
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
