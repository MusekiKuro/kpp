-- T16 / F06: Atomic Gallery Primary Invariant, Reordering, and Storage Cleanups.
-- 1. Ensure updated_at column on product_images table.
-- 2. PL/pgSQL function to enforce the primary image invariant (if count > 0 then count(is_primary) == 1) with admin JWT check.
-- 3. PL/pgSQL function to atomically toggle primary image for a product.
-- 4. PL/pgSQL function to bulk reorder images for a product with strict complete set validation.
-- 5. Atomic create, delete, and storage cleanup queue integration.

ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL DEFAULT 'product-images',
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_cleanup_queue_active_path
  ON public.storage_cleanup_queue (bucket, storage_path)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage storage cleanup queue" ON public.storage_cleanup_queue;
CREATE POLICY "Admins manage storage cleanup queue" ON public.storage_cleanup_queue
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

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

  INSERT INTO public.storage_cleanup_queue (bucket, storage_path)
  VALUES (COALESCE(p_bucket, 'product-images'), p_storage_path)
  ON CONFLICT (bucket, storage_path) WHERE status IN ('pending', 'processing')
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.enqueue_storage_cleanup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_storage_cleanup(TEXT, TEXT) TO authenticated;

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

  -- Lock product row for concurrency control
  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM public.product_images WHERE id = p_image_id AND product_id = p_product_id) THEN
    RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.product_images
  SET is_primary = (id = p_image_id), updated_at = now()
  WHERE product_id = p_product_id;

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

  -- Lock product row
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

-- Create gallery image and set primary atomically in a single transaction
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

  -- Lock product row to serialize gallery mutations
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

-- Delete gallery image, assign next primary, and enqueue cleanup job atomically
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

  -- Lock product row
  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;

  SELECT storage_path, source_url INTO v_storage_path, v_source_url
  FROM public.product_images
  WHERE id = p_image_id AND product_id = p_product_id;

  IF v_storage_path IS NULL AND v_source_url IS NULL THEN
    RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
  END IF;

  -- Enqueue cleanup job inside the DB transaction BEFORE row removal
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
