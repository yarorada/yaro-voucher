
-- Create deal_supplier_invoices table
CREATE TABLE public.deal_supplier_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  supplier_name text,
  total_amount numeric,
  currency text DEFAULT 'CZK',
  issue_date date,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at date,
  payment_method text,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_supplier_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies (team-shared pattern)
CREATE POLICY "Authenticated users can view deal_supplier_invoices"
  ON public.deal_supplier_invoices FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create deal_supplier_invoices"
  ON public.deal_supplier_invoices FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal_supplier_invoices"
  ON public.deal_supplier_invoices FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deal_supplier_invoices"
  ON public.deal_supplier_invoices FOR DELETE USING (true);

-- Storage bucket for supplier invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-invoices', 'supplier-invoices', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload supplier invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'supplier-invoices' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view supplier invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'supplier-invoices');

CREATE POLICY "Authenticated users can delete supplier invoices"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'supplier-invoices' AND auth.role() = 'authenticated');
