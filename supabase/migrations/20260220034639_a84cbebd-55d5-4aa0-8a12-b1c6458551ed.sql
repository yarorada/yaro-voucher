
-- Step 1: Move destinations from old 2-letter country to correct 3-letter country
UPDATE public.destinations SET country_id = '3590bdc2-15f9-486d-91c4-517d81e2f66d' WHERE country_id = '87812dd1-5d60-4aae-bc12-0e68b9e0b2f9';
UPDATE public.destinations SET country_id = '1418d303-113a-4006-ba16-e9886ffc3f2d' WHERE country_id = '360bf840-b284-41b6-9a68-fe3c1ed07a46';

-- Step 2: Delete duplicate countries with old 2-letter codes
DELETE FROM public.countries WHERE id = '87812dd1-5d60-4aae-bc12-0e68b9e0b2f9';
DELETE FROM public.countries WHERE id = '360bf840-b284-41b6-9a68-fe3c1ed07a46';

-- Step 3: Fix SPA → ESP if exists
UPDATE public.countries SET iso_code = 'ESP' WHERE iso_code = 'SPA';

-- Step 4: Fix airport_templates 2-letter country codes to 3-letter
UPDATE public.airport_templates SET country = 'AUT' WHERE country = 'AT';
UPDATE public.airport_templates SET country = 'CYP' WHERE country = 'CY';
UPDATE public.airport_templates SET country = 'CZE' WHERE country = 'CZ';
UPDATE public.airport_templates SET country = 'DEU' WHERE country = 'DE';
UPDATE public.airport_templates SET country = 'FRA' WHERE country = 'FR';
UPDATE public.airport_templates SET country = 'GBR' WHERE country = 'GB';
UPDATE public.airport_templates SET country = 'GRC' WHERE country = 'GR';
UPDATE public.airport_templates SET country = 'MLI' WHERE country = 'ML';
UPDATE public.airport_templates SET country = 'NLD' WHERE country = 'NL';
UPDATE public.airport_templates SET country = 'TUR' WHERE country = 'TR';
