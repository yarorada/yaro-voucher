-- UCTO výstup — Etapa 4: bankovní výpisy v měsíční složce

-- 1) Tabulka bank_statements --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                 -- 'YYYY-MM'
  bank TEXT NOT NULL DEFAULT 'other',   -- 'moneta' | 'amnis' | 'other'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accounting_batch_id UUID REFERENCES public.accounting_batches(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_period
  ON public.bank_statements (user_id, period)
  WHERE accounting_batch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statements_batch
  ON public.bank_statements (accounting_batch_id)
  WHERE accounting_batch_id IS NOT NULL;

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bank statements" ON public.bank_statements;
CREATE POLICY "Users manage own bank statements"
  ON public.bank_statements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Bucket bank-statements (privátní) ----------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own bank statements" ON storage.objects;
CREATE POLICY "Users upload own bank statements"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own bank statements" ON storage.objects;
CREATE POLICY "Users read own bank statements"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bank-statements'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own bank statements" ON storage.objects;
CREATE POLICY "Users update own bank statements"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'bank-statements'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own bank statements" ON storage.objects;
CREATE POLICY "Users delete own bank statements"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bank-statements'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
