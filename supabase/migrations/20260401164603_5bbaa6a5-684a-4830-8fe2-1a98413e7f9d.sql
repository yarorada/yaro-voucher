ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'supplier';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS ico text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS dic text;