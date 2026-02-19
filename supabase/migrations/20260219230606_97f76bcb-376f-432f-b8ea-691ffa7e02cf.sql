
-- Table for incoming bank payment notifications
CREATE TABLE public.bank_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_text text NOT NULL,
  parsed_amount numeric,
  parsed_vs text,
  parsed_date date,
  matched_payment_id uuid REFERENCES public.contract_payments(id),
  matched_contract_id uuid REFERENCES public.travel_contracts(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  confirmed_at timestamptz,
  notes text
);

ALTER TABLE public.bank_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bank_notifications"
  ON public.bank_notifications FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update bank_notifications"
  ON public.bank_notifications FOR UPDATE USING (true);

CREATE POLICY "Service role can insert bank_notifications"
  ON public.bank_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bank_notifications"
  ON public.bank_notifications FOR DELETE USING (true);
