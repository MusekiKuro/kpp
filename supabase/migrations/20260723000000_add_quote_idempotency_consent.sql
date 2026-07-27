-- T07 additive follow-up. Review and apply on staging before production.
-- No RLS policy is added for public clients; quote writes remain server-only.

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_idempotency_key_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_idempotency_key_check
      CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_idempotency_key_unique_idx
  ON public.quote_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
