DROP TRIGGER IF EXISTS copy_deal_payments_on_contract_insert ON public.travel_contracts;
DROP TRIGGER IF EXISTS trg_copy_deal_payments_to_contract ON public.travel_contracts;
DROP TRIGGER IF EXISTS trg_sync_deal_payment_to_contracts ON public.deal_payments;