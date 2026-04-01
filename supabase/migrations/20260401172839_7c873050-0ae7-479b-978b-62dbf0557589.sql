
-- Add variable_symbol and due_date to deal_supplier_invoices
ALTER TABLE public.deal_supplier_invoices ADD COLUMN IF NOT EXISTS variable_symbol text;
ALTER TABLE public.deal_supplier_invoices ADD COLUMN IF NOT EXISTS due_date date;

-- Update the sync trigger to include the new fields
CREATE OR REPLACE FUNCTION public.sync_deal_supplier_invoice_to_invoices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoices (
      user_id, invoice_type, deal_id, deal_supplier_invoice_id,
      supplier_name, total_amount, currency, issue_date,
      paid, paid_at, file_url, file_name, payment_method,
      variable_symbol, due_date
    ) VALUES (
      NEW.user_id, 'received', NEW.deal_id, NEW.id,
      NEW.supplier_name, NEW.total_amount, COALESCE(NEW.currency, 'CZK'), NEW.issue_date,
      NEW.is_paid, NEW.paid_at, NEW.file_url, NEW.file_name, NEW.payment_method,
      NEW.variable_symbol, NEW.due_date
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
      payment_method = NEW.payment_method,
      variable_symbol = NEW.variable_symbol,
      due_date = NEW.due_date
    WHERE deal_supplier_invoice_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.invoices WHERE deal_supplier_invoice_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
