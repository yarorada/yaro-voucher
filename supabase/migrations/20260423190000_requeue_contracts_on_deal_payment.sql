-- Po dropu contract_payments (migrace 20260423170000) zanikl CASCADE i trigger
-- trg_set_contract_queued_on_first_payment, který při první platbě zařazoval
-- smlouvu do fronty pro UCTO výstup (accounting_queued_at).
-- Přesouváme ho na deal_payments — smlouva se dohledá přes deal_id.

CREATE OR REPLACE FUNCTION public.set_contract_queued_on_first_deal_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.paid IS DISTINCT FROM TRUE) THEN
    UPDATE public.travel_contracts
       SET accounting_queued_at = COALESCE(accounting_queued_at, COALESCE(NEW.paid_at, NOW()))
     WHERE deal_id = NEW.deal_id
       AND accounting_queued_at IS NULL
       AND accounting_batch_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_queued_on_first_deal_payment ON public.deal_payments;
CREATE TRIGGER trg_set_contract_queued_on_first_deal_payment
  AFTER INSERT OR UPDATE OF paid ON public.deal_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contract_queued_on_first_deal_payment();

-- Uklidit starou funkci vázanou na contract_payments (trigger už neexistuje, funkce může)
DROP FUNCTION IF EXISTS public.set_contract_queued_on_first_payment() CASCADE;

-- Backfill — v případě, že mezi nasazením vlny B a této migrace přišly platby,
-- které se kvůli chybějícímu triggeru nezařadily
UPDATE public.travel_contracts c
   SET accounting_queued_at = COALESCE(c.accounting_queued_at,
                                       (SELECT MIN(p.paid_at)
                                          FROM public.deal_payments p
                                         WHERE p.deal_id = c.deal_id AND p.paid IS TRUE),
                                       NOW())
 WHERE c.accounting_queued_at IS NULL
   AND c.accounting_batch_id IS NULL
   AND c.deal_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.deal_payments p
                WHERE p.deal_id = c.deal_id AND p.paid IS TRUE);
