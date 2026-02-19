
-- Add price_currency to deal_services
ALTER TABLE public.deal_services
ADD COLUMN price_currency character varying DEFAULT 'CZK';

-- Add price_currency to deal_variant_services
ALTER TABLE public.deal_variant_services
ADD COLUMN price_currency character varying DEFAULT 'CZK';

-- Add currency to deals (derived from services, used for payment schedule)
ALTER TABLE public.deals
ADD COLUMN currency character varying DEFAULT 'CZK';
