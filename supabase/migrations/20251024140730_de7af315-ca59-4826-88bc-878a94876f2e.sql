-- Add supplier_id to vouchers table
ALTER TABLE public.vouchers 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_vouchers_supplier_id ON public.vouchers(supplier_id);