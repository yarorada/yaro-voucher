
CREATE TABLE public.offer_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  client_name TEXT,
  client_email TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_responses ENABLE ROW LEVEL SECURITY;

-- Anonymous INSERT (client is not logged in)
CREATE POLICY "Anyone can insert offer_responses"
  ON public.offer_responses FOR INSERT
  WITH CHECK (true);

-- Read only for authenticated users (CRM)
CREATE POLICY "Authenticated users can view offer_responses"
  ON public.offer_responses FOR SELECT
  USING (auth.role() = 'authenticated');
