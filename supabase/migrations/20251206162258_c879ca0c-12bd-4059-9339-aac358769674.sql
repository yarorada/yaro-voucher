-- Add english_name column to service_templates
ALTER TABLE public.service_templates 
ADD COLUMN IF NOT EXISTS english_name text;

-- Update existing records with English translations
UPDATE public.service_templates SET english_name = 'Accommodation' WHERE name = 'Ubytování';
UPDATE public.service_templates SET english_name = 'Flight' WHERE name = 'Letenka';
UPDATE public.service_templates SET english_name = 'Green Fee' WHERE name = 'Green Fee';
UPDATE public.service_templates SET english_name = 'Transfer' WHERE name = 'Transfer';
UPDATE public.service_templates SET english_name = 'Rent-a-car' WHERE name = 'Rent-a-car';
UPDATE public.service_templates SET english_name = 'Meals' WHERE name = 'Strava';
UPDATE public.service_templates SET english_name = 'Insurance' WHERE name = 'Pojištění';
UPDATE public.service_templates SET english_name = 'Assistance' WHERE name = 'Asistence';
UPDATE public.service_templates SET english_name = 'Visa' WHERE name = 'Víza';
UPDATE public.service_templates SET english_name = 'Golf Package' WHERE name = 'Golfový balíček';
UPDATE public.service_templates SET english_name = 'Wellness' WHERE name = 'Wellness';
UPDATE public.service_templates SET english_name = 'Excursion' WHERE name = 'Výlet';