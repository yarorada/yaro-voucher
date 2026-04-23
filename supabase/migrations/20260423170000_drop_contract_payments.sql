-- Fáze 3: kompletní odstranění tabulky contract_payments.
-- Platby existují výhradně v deal_payments; smlouva se na ně dotazuje přes deal_id.
-- Edge funkce (bank-webhook, parse-payment-email, confirm-payment-match,
-- get-public-accounting) byly přepsány tak, aby pracovaly
-- s deal_payments — matched_payment_id v bank_notifications nyní odkazuje na deal_payments.id.

-- 1) Uvolni FK bank_notifications.matched_payment_id → contract_payments (pokud existuje)
ALTER TABLE IF EXISTS public.bank_notifications
  DROP CONSTRAINT IF EXISTS bank_notifications_matched_payment_id_fkey;

-- matched_payment_id necháváme jako UUID bez FK (může odkazovat na deal_payments.id).
-- Volitelně lze později přidat FK na deal_payments, ale historické notifikace by
-- přestaly procházet — proto necháváme bez referential integrity.

-- 2) DROP trigger funkcí, které kopírovaly deal_payments ↔ contract_payments
DROP FUNCTION IF EXISTS public.copy_deal_payments_to_contract() CASCADE;
DROP FUNCTION IF EXISTS public.sync_deal_payment_to_contracts() CASCADE;

-- 3) DROP tabulky contract_payments (CASCADE odstraní případné zbylé triggery/views/policies)
DROP TABLE IF EXISTS public.contract_payments CASCADE;
