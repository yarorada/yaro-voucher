-- Client wallet schema - loyalty points system
-- Immutable ledger of wallet transactions
CREATE TABLE IF NOT EXISTS public.client_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'reverse_earn', 'reverse_redeem', 'adjust')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_client ON public.client_wallet_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_deal ON public.client_wallet_transactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_client_wallet_tx_created ON public.client_wallet_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.client_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: users can view wallet transactions for clients in their data scope
CREATE POLICY "Users can view wallet transactions"
  ON public.client_wallet_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_wallet_transactions.client_id
        AND (c.user_id = auth.uid() OR NOT has_role(auth.uid(), 'prodejce'::app_role))
    )
  );

-- RLS: users can insert wallet transactions for clients in their data scope
CREATE POLICY "Users can insert wallet transactions"
  ON public.client_wallet_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_wallet_transactions.client_id
        AND (c.user_id = auth.uid() OR NOT has_role(auth.uid(), 'prodejce'::app_role))
    )
  );

-- Immutable ledger: no updates, no deletes (intentionally no policies)

-- Add wallet columns to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS wallet_points_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS wallet_points_earned_at TIMESTAMPTZ;

-- View: aggregated balance per client
CREATE OR REPLACE VIEW public.client_wallet_balances AS
SELECT
  client_id,
  COALESCE(SUM(points), 0)::INTEGER AS balance
FROM public.client_wallet_transactions
GROUP BY client_id;

-- Function: get balance for a single client
CREATE OR REPLACE FUNCTION public.get_client_wallet_balance(_client_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
  FROM public.client_wallet_transactions
  WHERE client_id = _client_id;
$$;