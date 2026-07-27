-- T15 / F04: Atomic CMS Product & Attribute Updates and Automatic updated_at Triggers.
-- 1. Automatic updated_at triggers for CMS-edited tables.
-- 2. Additive options column on attributes table.
-- 3. Atomic SECURITY DEFINER RPC public.save_cms_product_attributes with strict admin JWT role check.

ALTER TABLE public.attributes ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attributes_options_array'
  ) THEN
    ALTER TABLE public.attributes ADD CONSTRAINT chk_attributes_options_array CHECK (jsonb_typeof(options) = 'array');
  END IF;
END $$;

-- 1. Trigger function to automatically update updated_at timestamp on row modification
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
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_brands_updated_at ON public.brands;
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_attributes_updated_at ON public.attributes;
CREATE TRIGGER trg_attributes_updated_at
  BEFORE UPDATE ON public.attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_attribute_values_updated_at ON public.product_attribute_values;
CREATE TRIGGER trg_product_attribute_values_updated_at
  BEFORE UPDATE ON public.product_attribute_values
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_product_images_updated_at ON public.product_images;
CREATE TRIGGER trg_product_images_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Atomic RPC function for updating product and replacing attribute values in one transaction
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
  -- Strict Admin Authorization Check via JWT app_metadata
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Verify and lock target product
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id FOR UPDATE) THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002';
  END IF;

  -- Update product row
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

  -- Synchronize attributes atomically if provided
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
