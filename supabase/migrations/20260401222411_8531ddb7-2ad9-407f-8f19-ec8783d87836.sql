
ALTER TABLE public.travel_contracts
  ADD COLUMN accounting_sell_deposit_locked numeric,
  ADD COLUMN accounting_buy_deposit_locked numeric,
  ADD COLUMN accounting_profit_deposit_locked numeric,
  ADD COLUMN accounting_deposit_locked_at timestamptz;
