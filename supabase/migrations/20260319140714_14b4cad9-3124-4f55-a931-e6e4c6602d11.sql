
-- Recreate trigger: copy deal payments to contract on contract INSERT
DROP TRIGGER IF EXISTS copy_deal_payments_on_contract_insert ON public.travel_contracts;
CREATE TRIGGER copy_deal_payments_on_contract_insert
  AFTER INSERT ON public.travel_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_deal_payments_to_contract();

-- Recreate trigger: sync deal payment changes to linked contracts (UPDATE/DELETE only to avoid duplication with above)
DROP TRIGGER IF EXISTS trg_sync_deal_payment_to_contracts ON public.deal_payments;
CREATE TRIGGER trg_sync_deal_payment_to_contracts
  AFTER UPDATE OR DELETE ON public.deal_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deal_payment_to_contracts();
