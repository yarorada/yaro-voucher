-- Add tee_times and flights columns to vouchers table
ALTER TABLE public.vouchers 
ADD COLUMN tee_times jsonb DEFAULT '[]'::jsonb,
ADD COLUMN flights jsonb DEFAULT '[]'::jsonb;