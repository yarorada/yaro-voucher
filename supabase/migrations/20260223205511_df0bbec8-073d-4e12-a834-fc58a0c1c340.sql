
CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_id uuid;
  v_variant record;
BEGIN
  IF auth.uid() IS NULL AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT deal_id INTO v_deal_id
  FROM deal_variants
  WHERE id = p_variant_id;

  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  -- Deselect all variants for this deal
  UPDATE deal_variants SET is_selected = false WHERE deal_id = v_deal_id;
  -- Select the chosen variant
  UPDATE deal_variants SET is_selected = true WHERE id = p_variant_id;

  -- Get variant details for deal summary update
  SELECT destination_id, start_date, end_date, total_price
  INTO v_variant
  FROM deal_variants
  WHERE id = p_variant_id;

  -- Delete existing deal services
  DELETE FROM deal_services WHERE deal_id = v_deal_id;

  -- Copy variant services to deal services
  INSERT INTO deal_services (
    deal_id, service_type, service_name, description, supplier_id,
    start_date, end_date, person_count, price, price_currency,
    cost_price, cost_price_original, cost_currency,
    quantity, order_index, details
  )
  SELECT
    v_deal_id, vs.service_type, vs.service_name, vs.description, vs.supplier_id,
    vs.start_date, vs.end_date, vs.person_count, vs.price, vs.price_currency,
    vs.cost_price, vs.cost_price_original, vs.cost_currency,
    vs.quantity, vs.order_index, vs.details
  FROM deal_variant_services vs
  WHERE vs.variant_id = p_variant_id
  ORDER BY vs.order_index;

  -- Update deal summary fields from variant
  UPDATE deals SET
    destination_id = v_variant.destination_id,
    start_date = v_variant.start_date,
    end_date = v_variant.end_date,
    total_price = v_variant.total_price
  WHERE id = v_deal_id;

  RETURN true;
END;
$function$;
