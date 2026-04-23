-- Wave B: úplné odstranění tabulky contract_payments
-- Záloha CSV byla pořízena před spuštěním migrace.

-- 1) FK z bank_notifications na contract_payments
ALTER TABLE public.bank_notifications
  DROP CONSTRAINT IF EXISTS bank_notifications_matched_payment_id_fkey;

-- 2) Trigger funkce, které synchronizovaly contract_payments
DROP FUNCTION IF EXISTS public.copy_deal_payments_to_contract() CASCADE;
DROP FUNCTION IF EXISTS public.sync_deal_payment_to_contracts() CASCADE;

-- 3) Samotná tabulka
DROP TABLE IF EXISTS public.contract_payments CASCADE;