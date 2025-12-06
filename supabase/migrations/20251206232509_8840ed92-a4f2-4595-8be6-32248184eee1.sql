CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id UUID;
  v_variant RECORD;
BEGIN
  -- Get the variant and deal_id
  SELECT * INTO v_variant
  FROM deal_variants
  WHERE id = p_variant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;
  
  v_deal_id := v_variant.deal_id;
  
  -- Unselect all other variants for this deal
  UPDATE deal_variants
  SET is_selected = false
  WHERE deal_id = v_deal_id AND id != p_variant_id;
  
  -- Select this variant
  UPDATE deal_variants
  SET is_selected = true
  WHERE id = p_variant_id;
  
  -- Copy variant data to main deal
  UPDATE deals
  SET 
    destination_id = v_variant.destination_id,
    start_date = v_variant.start_date,
    end_date = v_variant.end_date,
    total_price = v_variant.total_price
  WHERE id = v_deal_id;
  
  -- Delete existing deal services
  DELETE FROM deal_services WHERE deal_id = v_deal_id;
  
  -- Copy variant services to deal services with all fields
  INSERT INTO deal_services (
    deal_id,
    service_type,
    service_name,
    description,
    supplier_id,
    start_date,
    end_date,
    person_count,
    price,
    cost_price,
    details,
    order_index
  )
  SELECT
    v_deal_id,
    service_type,
    service_name,
    description,
    supplier_id,
    start_date,
    end_date,
    person_count,
    price,
    cost_price,
    details,
    order_index
  FROM deal_variant_services
  WHERE variant_id = p_variant_id
  ORDER BY order_index NULLS LAST;
  
  -- Update deal display number
  PERFORM update_deal_display_number(v_deal_id);
  
  RETURN true;
END;
$$;