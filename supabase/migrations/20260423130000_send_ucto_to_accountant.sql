-- UCTO výstup — Etapa 3: odeslání ZIP balíčku účetnímu
-- Privátní storage bucket pro archiv ZIPů + sloupce pro audit odeslání.

-- 1) Bucket ucto-archives (privátní) ------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('ucto-archives', 'ucto-archives', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: každý uživatel sahá pouze do svého subfolderu (<user_id>/...)
DROP POLICY IF EXISTS "Users upload own ucto archives" ON storage.objects;
CREATE POLICY "Users upload own ucto archives"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ucto-archives'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own ucto archives" ON storage.objects;
CREATE POLICY "Users read own ucto archives"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ucto-archives'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own ucto archives" ON storage.objects;
CREATE POLICY "Users update own ucto archives"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ucto-archives'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own ucto archives" ON storage.objects;
CREATE POLICY "Users delete own ucto archives"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ucto-archives'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2) Sloupce na accounting_batches pro audit odeslání -------------------------
ALTER TABLE public.accounting_batches
  ADD COLUMN IF NOT EXISTS sent_to_accountant_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_accountant_email text,
  ADD COLUMN IF NOT EXISTS sent_zip_path          text,
  ADD COLUMN IF NOT EXISTS sent_zip_size_bytes    bigint;
