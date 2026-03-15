
-- Attach the existing copy_deal_payments_to_contract function as a trigger on travel_contracts INSERT
CREATE OR REPLACE TRIGGER trg_copy_deal_payments_to_contract
  AFTER INSERT ON public.travel_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_deal_payments_to_contract();
