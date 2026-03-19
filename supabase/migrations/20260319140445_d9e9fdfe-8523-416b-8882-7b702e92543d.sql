
-- Remove INSERT from trigger (copy_deal_payments_to_contract already handles it at contract creation)
-- Keep only UPDATE and DELETE sync
DROP TRIGGER IF EXISTS trg_sync_deal_payment_to_contracts ON public.deal_payments;

CREATE TRIGGER trg_sync_deal_payment_to_contracts
AFTER UPDATE OR DELETE ON public.deal_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_deal_payment_to_contracts();
