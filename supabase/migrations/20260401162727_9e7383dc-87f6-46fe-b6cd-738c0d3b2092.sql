
-- Create invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  invoice_type text NOT NULL DEFAULT 'received' CHECK (invoice_type IN ('received', 'issued')),
  invoice_number text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  deal_supplier_invoice_id uuid REFERENCES public.deal_supplier_invoices(id) ON DELETE SET NULL,
  client_name text,
  client_ico text,
  client_dic text,
  client_address text,
  supplier_name text,
  supplier_ico text,
  supplier_dic text,
  supplier_address text,
  total_amount numeric,
  currency text DEFAULT 'CZK',
  issue_date date,
  due_date date,
  paid boolean DEFAULT false,
  paid_at date,
  variable_symbol text,
  bank_account text,
  iban text,
  file_url text,
  file_name text,
  notes text,
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR has_full_data_scope(auth.uid()));

CREATE POLICY "Users can create invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR has_full_data_scope(auth.uid()));

CREATE POLICY "Users can delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR has_full_data_scope(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sync trigger: deal_supplier_invoices -> invoices
CREATE OR REPLACE FUNCTION public.sync_deal_supplier_invoice_to_invoices()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoices (
      user_id, invoice_type, deal_id, deal_supplier_invoice_id,
      supplier_name, total_amount, currency, issue_date,
      paid, paid_at, file_url, file_name, payment_method
    ) VALUES (
      NEW.user_id, 'received', NEW.deal_id, NEW.id,
      NEW.supplier_name, NEW.total_amount, COALESCE(NEW.currency, 'CZK'), NEW.issue_date,
      NEW.is_paid, NEW.paid_at, NEW.file_url, NEW.file_name, NEW.payment_method
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.invoices SET
      supplier_name = NEW.supplier_name,
      total_amount = NEW.total_amount,
      currency = COALESCE(NEW.currency, 'CZK'),
      issue_date = NEW.issue_date,
      paid = NEW.is_paid,
      paid_at = NEW.paid_at,
      file_url = NEW.file_url,
      file_name = NEW.file_name,
      payment_method = NEW.payment_method
    WHERE deal_supplier_invoice_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.invoices WHERE deal_supplier_invoice_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_supplier_invoice_to_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION sync_deal_supplier_invoice_to_invoices();

-- Import existing deal_supplier_invoices
INSERT INTO public.invoices (
  user_id, invoice_type, deal_id, deal_supplier_invoice_id,
  supplier_name, total_amount, currency, issue_date,
  paid, paid_at, file_url, file_name, payment_method
)
SELECT
  user_id, 'received', deal_id, id,
  supplier_name, total_amount, COALESCE(currency, 'CZK'), issue_date,
  is_paid, paid_at, file_url, file_name, payment_method
FROM public.deal_supplier_invoices;
