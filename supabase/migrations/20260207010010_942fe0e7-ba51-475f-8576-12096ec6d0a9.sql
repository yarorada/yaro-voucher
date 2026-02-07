
-- Add bank account column to travel_contracts
ALTER TABLE public.travel_contracts
ADD COLUMN agency_bank_account text DEFAULT '227993932/0600';

-- Update all existing contracts to have the bank account
UPDATE public.travel_contracts
SET agency_bank_account = '227993932/0600'
WHERE agency_bank_account IS NULL;

-- Sync payments from deal_payments to contract_payments for contracts that have a deal but no payments
INSERT INTO public.contract_payments (contract_id, payment_type, amount, due_date, notes, paid, paid_at)
SELECT tc.id, dp.payment_type, dp.amount, dp.due_date, dp.notes, dp.paid, dp.paid_at
FROM public.travel_contracts tc
JOIN public.deal_payments dp ON dp.deal_id = tc.deal_id
WHERE tc.deal_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.contract_payments cp WHERE cp.contract_id = tc.id
);
