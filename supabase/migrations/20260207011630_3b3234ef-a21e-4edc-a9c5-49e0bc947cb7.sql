
-- Create trigger function to automatically copy deal payments to contract payments
CREATE OR REPLACE FUNCTION public.copy_deal_payments_to_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only copy if the contract has a deal_id
  IF NEW.deal_id IS NOT NULL THEN
    INSERT INTO contract_payments (contract_id, payment_type, amount, due_date, notes, paid, paid_at)
    SELECT NEW.id, dp.payment_type, dp.amount, dp.due_date, dp.notes, dp.paid, dp.paid_at
    FROM deal_payments dp
    WHERE dp.deal_id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on travel_contracts insert
CREATE TRIGGER copy_deal_payments_on_contract_insert
  AFTER INSERT ON public.travel_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_deal_payments_to_contract();
