ALTER TABLE public.deals
  ADD CONSTRAINT deals_lead_client_id_fkey
  FOREIGN KEY (lead_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;