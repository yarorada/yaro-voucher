-- Add sent_at timestamp to track when voucher was emailed
ALTER TABLE public.vouchers ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;