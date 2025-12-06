-- Add paid_at column to contract_payments
ALTER TABLE public.contract_payments 
ADD COLUMN paid_at timestamp with time zone DEFAULT NULL;