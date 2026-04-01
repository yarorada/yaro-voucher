
-- Function to generate invoice number in FAV-RRNNN format
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.invoices
  WHERE invoice_type = 'issued'
    AND invoice_number LIKE 'FAV' || v_year || '%';
  
  RETURN 'FAV' || v_year || LPAD(v_count::TEXT, 3, '0');
END;
$$;

-- Trigger to auto-set invoice number and variable symbol for issued invoices
CREATE OR REPLACE FUNCTION public.set_issued_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_type = 'issued' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '') THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  -- Auto-set variable symbol from invoice number if not provided
  IF NEW.invoice_type = 'issued' AND (NEW.variable_symbol IS NULL OR NEW.variable_symbol = '') AND NEW.invoice_number IS NOT NULL THEN
    NEW.variable_symbol := regexp_replace(NEW.invoice_number, '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_issued_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_issued_invoice_number();
