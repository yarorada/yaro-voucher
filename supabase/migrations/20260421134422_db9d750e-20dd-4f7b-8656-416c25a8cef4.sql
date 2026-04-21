CREATE OR REPLACE FUNCTION public.generate_deal_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.deals
  WHERE deal_number LIKE 'D-' || v_year || '%';

  v_new_number := 'D-' || v_year || LPAD(v_count::TEXT, 3, '0');

  RETURN v_new_number;
END;
$$;