-- T08: fields required by the admin CMS that were not present in the additive T02 schema.
-- Apply only after the normal staging backup and migration rehearsal.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_title_ru TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_kk TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_ru TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_kk TEXT;

ALTER TABLE public.attributes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attributes_status_check'
      AND conrelid = 'public.attributes'::regclass
  ) THEN
    ALTER TABLE public.attributes
      ADD CONSTRAINT attributes_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attributes_status_sort_idx
  ON public.attributes (status, sort_order, code);

DROP POLICY IF EXISTS "Public read attributes" ON public.attributes;
CREATE POLICY "Public read attributes"
  ON public.attributes FOR SELECT TO public
  USING (
    status = 'published'
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = category_id AND c.status = 'published'
      )
    )
  );
