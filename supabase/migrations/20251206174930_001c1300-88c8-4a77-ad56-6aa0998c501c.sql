-- Add order_index column to deal_services table
ALTER TABLE public.deal_services 
ADD COLUMN order_index integer DEFAULT 0;

-- Add order_index column to deal_variant_services table as well
ALTER TABLE public.deal_variant_services 
ADD COLUMN order_index integer DEFAULT 0;