-- Add service_type column to service_templates
ALTER TABLE public.service_templates 
ADD COLUMN service_type text;

-- Update existing templates with their service types
UPDATE public.service_templates SET service_type = 'hotel' WHERE name IN ('Ubytování', 'Wellness');
UPDATE public.service_templates SET service_type = 'flight' WHERE name = 'Letenka';
UPDATE public.service_templates SET service_type = 'golf' WHERE name IN ('Green Fee', 'Golfový balíček');
UPDATE public.service_templates SET service_type = 'transfer' WHERE name IN ('Transfer', 'Rent-a-car');
UPDATE public.service_templates SET service_type = 'insurance' WHERE name = 'Pojištění';
UPDATE public.service_templates SET service_type = 'other' WHERE name IN ('Strava', 'Asistence', 'Víza', 'Výlet');