-- Add person_count column to deal_services table
ALTER TABLE public.deal_services 
ADD COLUMN person_count integer DEFAULT 1;

COMMENT ON COLUMN public.deal_services.person_count IS 'Number of persons for this service';