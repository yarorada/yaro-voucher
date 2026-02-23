CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT deal_id INTO v_deal_id
  FROM deal_variants
  WHERE id = p_variant_id;

  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  UPDATE deal_variants SET is_selected = false WHERE deal_id = v_deal_id;
  UPDATE deal_variants SET is_selected = true WHERE id = p_variant_id;

  RETURN true;
END;
$$;