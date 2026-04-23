-- Internal-only split of a deal payment among multiple payers.
-- Purpose: local bookkeeping (who paid what, when) for deals where each
-- traveller pays their own share. Splits are NOT synced to travel_contracts /
-- contract_payments — the contract always reflects the aggregate deal payment.

CREATE TABLE IF NOT EXISTS public.deal_payment_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.deal_payments(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_payment_splits_payment_id
  ON public.deal_payment_splits(payment_id);

ALTER TABLE public.deal_payment_splits ENABLE ROW LEVEL SECURITY;

-- RLS follows the owning deal via deal_payments → deals.user_id
CREATE POLICY "Users can view deal payment splits" ON public.deal_payment_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.deal_payments dp
      JOIN public.deals d ON d.id = dp.deal_id
      WHERE dp.id = deal_payment_splits.payment_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert deal payment splits" ON public.deal_payment_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deal_payments dp
      JOIN public.deals d ON d.id = dp.deal_id
      WHERE dp.id = deal_payment_splits.payment_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update deal payment splits" ON public.deal_payment_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.deal_payments dp
      JOIN public.deals d ON d.id = dp.deal_id
      WHERE dp.id = deal_payment_splits.payment_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete deal payment splits" ON public.deal_payment_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.deal_payments dp
      JOIN public.deals d ON d.id = dp.deal_id
      WHERE dp.id = deal_payment_splits.payment_id
        AND d.user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.deal_payment_splits_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_payment_splits_updated_at ON public.deal_payment_splits;
CREATE TRIGGER trg_deal_payment_splits_updated_at
BEFORE UPDATE ON public.deal_payment_splits
FOR EACH ROW
EXECUTE FUNCTION public.deal_payment_splits_set_updated_at();
