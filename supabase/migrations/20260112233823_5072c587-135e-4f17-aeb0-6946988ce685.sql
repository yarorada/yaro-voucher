-- Add authentication verification to SECURITY DEFINER functions for defense in depth

-- Fix generate_voucher_code_for_year function
CREATE OR REPLACE FUNCTION public.generate_voucher_code_for_year(p_issue_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  v_new_code := 'YT-' || v_year_suffix || LPAD(v_next_num::TEXT, 3, '0');
  
  RETURN v_new_code;
END;
$$;

-- Fix select_deal_variant function - add explicit authentication check
CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_id uuid;
  v_user_id uuid;
BEGIN
  -- Verify caller is authenticated (defense in depth)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the deal_id and user_id for this variant
  SELECT deal_id, user_id INTO v_deal_id, v_user_id
  FROM deal_variants
  WHERE id = p_variant_id;
  
  -- Verify ownership
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this variant';
  END IF;
  
  -- Deselect all variants for this deal
  UPDATE deal_variants
  SET is_selected = false
  WHERE deal_id = v_deal_id;
  
  -- Select the specified variant
  UPDATE deal_variants
  SET is_selected = true
  WHERE id = p_variant_id;
  
  RETURN true;
END;
$$;