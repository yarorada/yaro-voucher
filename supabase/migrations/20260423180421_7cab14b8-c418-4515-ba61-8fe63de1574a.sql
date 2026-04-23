-- Oprava: na některých prostředích byla tabulka deal_payment_splits vytvořena
-- dřívější verzí migrace 20260423150000, která neobsahovala sloupec client_id.
-- Protože původní migrace používá CREATE TABLE IF NOT EXISTS, chybějící sloupec
-- už nikdy nedoplní — musíme ho přidat samostatnou ALTER migrací.

ALTER TABLE public.deal_payment_splits
  ADD COLUMN IF NOT EXISTS client_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deal_payment_splits_client_id_fkey'
      AND conrelid = 'public.deal_payment_splits'::regclass
  ) THEN
    ALTER TABLE public.deal_payment_splits
      ADD CONSTRAINT deal_payment_splits_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;