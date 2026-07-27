-- T09: atomic, retry-safe import apply. This function is intentionally admin-only.
-- Apply only on staging after backup/RLS rehearsal; never run it against production from an agent.

CREATE OR REPLACE FUNCTION public.apply_import_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.apply_import_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import_batch(UUID) TO authenticated;
