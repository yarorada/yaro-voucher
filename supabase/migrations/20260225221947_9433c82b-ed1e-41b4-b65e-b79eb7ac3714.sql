CREATE OR REPLACE FUNCTION public.generate_contract_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_num INTEGER;
  v_floor INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := SUBSTRING(EXTRACT(YEAR FROM NOW())::TEXT FROM 3 FOR 2);

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM 4 + LENGTH(v_year) + 1) AS INTEGER)
  ), 0)
  INTO v_max_num
  FROM public.travel_contracts
  WHERE contract_number ~ ('^CS-' || v_year || '\d+$');

  IF v_year = '26' THEN
    v_floor := 11;
  ELSE
    v_floor := 0;
  END IF;

  v_new_number := 'CS-' || v_year || LPAD((GREATEST(v_max_num, v_floor) + 1)::TEXT, 3, '0');

  RETURN v_new_number;
END;
$function$;