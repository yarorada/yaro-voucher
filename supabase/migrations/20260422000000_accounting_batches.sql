-- Tabulka pro archivní dávky dokladů pro účetní
CREATE TABLE IF NOT EXISTS public.accounting_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL, -- formát 'YYYY-MM'
  label TEXT,           -- např. "Duben 2026"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.accounting_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own batches"
  ON public.accounting_batches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Přidání sloupce pro přiřazení faktury do dávky
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS accounting_batch_id UUID REFERENCES public.accounting_batches(id) ON DELETE SET NULL;
