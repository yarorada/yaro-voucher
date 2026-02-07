CREATE OR REPLACE FUNCTION public.generate_contract_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_num INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Find the highest existing number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM 4 + LENGTH(v_year) + 1) AS INTEGER)
  ), 0) INTO v_max_num
  FROM public.travel_contracts
  WHERE contract_number ~ ('^CS-' || v_year || '\d+$');
  
  v_new_number := 'CS-' || v_year || LPAD((v_max_num + 1)::TEXT, 4, '0');
  
  RETURN v_new_number;
END;
$function$;