-- Fix the generate_voucher_code_for_year function to always use YT-YYNNN format
CREATE OR REPLACE FUNCTION public.generate_voucher_code_for_year(p_issue_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year INTEGER;
  v_year_suffix TEXT;
  v_next_num INTEGER;
  v_new_code TEXT;
BEGIN
  -- Verify caller is authenticated (defense in depth)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_year := EXTRACT(YEAR FROM p_issue_date);
  v_year_suffix := TO_CHAR(p_issue_date, 'YY');
  
  INSERT INTO public.voucher_counters (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_number = voucher_counters.last_number + 1
  RETURNING last_number INTO v_next_num;
  
  -- Generate code in YT-YYNNN format (e.g., YT-26001)
  v_new_code := 'YT-' || v_year_suffix || LPAD(v_next_num::TEXT, 3, '0');
  
  RETURN v_new_code;
END;
$function$;