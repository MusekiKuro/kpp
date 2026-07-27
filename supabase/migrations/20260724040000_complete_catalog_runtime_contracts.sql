-- Final local remediation for the public catalog filter, gallery primary switch,
-- option metadata, and recoverable Storage cleanup processing.
-- Apply only after a verified backup and staging rehearsal.

ALTER TABLE public.attributes
  ALTER COLUMN options SET DEFAULT '[]'::jsonb;

UPDATE public.attributes
SET options = '[]'::jsonb
WHERE options IS NULL;

ALTER TABLE public.attributes
  ALTER COLUMN options SET NOT NULL;

ALTER TABLE public.attributes
  DROP CONSTRAINT IF EXISTS chk_attributes_options_array;

ALTER TABLE public.attributes
  ADD CONSTRAINT chk_attributes_options_array
  CHECK (
    jsonb_typeof(options) = 'array'
    AND NOT jsonb_path_exists(options, '$[*] ? (@.type() != "string")')
  );

ALTER TABLE public.storage_cleanup_queue
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- A migration interrupted while a previous worker was running must not leave a
-- permanently unclaimable row behind.
UPDATE public.storage_cleanup_queue
SET
  status = 'failed',
  lease_token = NULL,
  lease_expires_at = NULL,
  next_attempt_at = now(),
  updated_at = now()
WHERE status = 'processing';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storage_cleanup_processing_lease_check'
      AND conrelid = 'public.storage_cleanup_queue'::regclass
  ) THEN
    ALTER TABLE public.storage_cleanup_queue
      ADD CONSTRAINT storage_cleanup_processing_lease_check
      CHECK (
        (status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
        OR
        (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)
      );
  END IF;
END $$;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_images
    WHERE id = p_image_id AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
  END IF;

  -- The partial unique index is immediate, so clear the old row first and set
  -- the requested row second inside the same transaction.
  UPDATE public.product_images
  SET is_primary = false, updated_at = now()
  WHERE product_id = p_product_id AND is_primary = true AND id <> p_image_id;

  UPDATE public.product_images
  SET is_primary = true, updated_at = now()
  WHERE id = p_image_id AND product_id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'primary_image_id', p_image_id
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.set_primary_product_image(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_product_image(UUID, UUID) TO authenticated;

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
