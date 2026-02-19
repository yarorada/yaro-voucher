
ALTER TABLE public.travel_contracts
ADD COLUMN currency character varying DEFAULT 'CZK'::character varying;

-- Backfill existing contracts with currency from their linked deals
UPDATE public.travel_contracts tc
SET currency = d.currency
FROM public.deals d
WHERE tc.deal_id = d.id
AND d.currency IS NOT NULL;
