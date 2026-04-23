-- Peněženka klienta: bodový systém
-- Pravidla:
--   * 50 Kč obratu bez letenek = 1 bod (načítá se po ukončení dealu)
--   * 1 bod = 1 Kč slevy při uplatnění
--   * max. 20 % z deal.total_price nového zájezdu
-- Zdrojem jsou rozpisy plateb (deal_payment_splits.client_id) + objednatel dealu.

-- 1) Immutable ledger všech pohybů v peněžence.
--    Oprava se dělá vždy novou transakcí (adjust), nikdy UPDATE/DELETE původní.
CREATE TABLE IF NOT EXISTS public.client_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earn','redeem','reverse_earn','reverse_redeem','adjust')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_client
  ON public.client_wallet_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_deal
  ON public.client_wallet_transactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_created
  ON public.client_wallet_transactions(created_at DESC);

ALTER TABLE public.client_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- CRM je interní nástroj, všichni přihlášení uživatelé mohou číst a zakládat.
-- Update/delete se přes API vůbec nepovoluje (žádná policy).
CREATE POLICY "Authenticated users can view wallet transactions"
  ON public.client_wallet_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert wallet transactions"
  ON public.client_wallet_transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2) Sloupce na dealu
--    wallet_points_used: kolik bodů objednatel uplatnil na tento deal (snižuje doplatek)
--    wallet_points_earned_at: čas, kdy se deal zúčtoval do peněženky (guard proti opakování)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS wallet_points_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_points_earned_at TIMESTAMPTZ;

-- 3) View pro rychlé čtení zůstatku peněženky klienta
CREATE OR REPLACE VIEW public.client_wallet_balances AS
  SELECT client_id, COALESCE(SUM(points), 0)::INTEGER AS balance
  FROM public.client_wallet_transactions
  GROUP BY client_id;

-- 4) Helper funkce: zůstatek konkrétního klienta (vrací 0 pro klienta bez transakcí)
CREATE OR REPLACE FUNCTION public.get_client_wallet_balance(p_client_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
  FROM public.client_wallet_transactions
  WHERE client_id = p_client_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_wallet_balance(UUID) TO authenticated;
