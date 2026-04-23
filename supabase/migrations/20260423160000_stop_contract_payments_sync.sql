-- Fáze 2: zastavení automatické synchronizace contract_payments ↔ deal_payments.
-- Smlouva (UI, PDF, signing) čte platby výhradně z deal_payments.
-- Tabulku contract_payments necháváme dormant kvůli zpětné kompatibilitě
-- s existujícími edge funkcemi (bank-webhook, parse-payment-email, …) —
-- její drop proběhne v samostatné migraci (Fáze 3), až budou přepsány.

-- 1) Trigger, který při insertu smlouvy kopíroval deal_payments → contract_payments
DROP TRIGGER IF EXISTS copy_deal_payments_on_contract_insert ON public.travel_contracts;
DROP TRIGGER IF EXISTS trg_copy_deal_payments_to_contract ON public.travel_contracts;

-- 2) Trigger, který synchronizoval změny deal_payments do contract_payments
DROP TRIGGER IF EXISTS trg_sync_deal_payment_to_contracts ON public.deal_payments;

-- Trigger funkce ponecháváme (DROP FUNCTION později, až padne tabulka):
--   public.copy_deal_payments_to_contract()
--   public.sync_deal_payment_to_contracts()
