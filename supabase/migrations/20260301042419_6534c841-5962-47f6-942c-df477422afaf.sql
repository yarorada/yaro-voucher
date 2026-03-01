
ALTER TABLE public.email_log
  DROP CONSTRAINT IF EXISTS email_log_deal_id_fkey;

ALTER TABLE public.email_log
  ADD CONSTRAINT email_log_deal_id_fkey
  FOREIGN KEY (deal_id)
  REFERENCES public.deals(id)
  ON DELETE SET NULL;
