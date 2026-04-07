CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year TEXT;
  v_max_num INTEGER;
  v_prefix TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  v_prefix := 'FAV' || v_year;
  
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '\D', '', 'g'), '')::INTEGER), (v_year || '000')::INTEGER) + 1
  INTO v_max_num
  FROM public.invoices
  WHERE invoice_type = 'issued'
    AND invoice_number LIKE v_prefix || '%';
  
  RETURN 'FAV' || v_max_num::TEXT;
END;
$$;