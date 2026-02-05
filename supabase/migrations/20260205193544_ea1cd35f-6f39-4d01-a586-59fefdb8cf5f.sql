-- Add currency support columns to deal_services
ALTER TABLE public.deal_services 
ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(3) DEFAULT 'CZK',
ADD COLUMN IF NOT EXISTS cost_price_original NUMERIC;

-- Add currency support columns to deal_variant_services
ALTER TABLE public.deal_variant_services 
ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(3) DEFAULT 'CZK',
ADD COLUMN IF NOT EXISTS cost_price_original NUMERIC;

-- Update existing records to set cost_price_original from cost_price where not null
UPDATE public.deal_services 
SET cost_price_original = cost_price, cost_currency = 'CZK' 
WHERE cost_price IS NOT NULL AND cost_price_original IS NULL;

UPDATE public.deal_variant_services 
SET cost_price_original = cost_price, cost_currency = 'CZK' 
WHERE cost_price IS NOT NULL AND cost_price_original IS NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN public.deal_services.cost_currency IS 'Currency code for the original cost price (e.g., EUR, USD, CZK)';
COMMENT ON COLUMN public.deal_services.cost_price_original IS 'Original cost price in the specified currency before conversion to CZK';
COMMENT ON COLUMN public.deal_variant_services.cost_currency IS 'Currency code for the original cost price (e.g., EUR, USD, CZK)';
COMMENT ON COLUMN public.deal_variant_services.cost_price_original IS 'Original cost price in the specified currency before conversion to CZK';