
ALTER TABLE public.offer_responses DROP CONSTRAINT offer_responses_deal_id_fkey;
ALTER TABLE public.offer_responses ADD CONSTRAINT offer_responses_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
