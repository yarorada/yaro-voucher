CREATE OR REPLACE FUNCTION public.update_deal_display_number(p_deal_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_number TEXT;
  v_first_traveler_name TEXT;
  v_orderer_name TEXT;
  v_first_traveler_client_id UUID;
  v_lead_client_id UUID;
  v_country_code TEXT;
  v_start_date TEXT;
  v_base_number TEXT;
  v_hotel_name TEXT;
BEGIN
  -- Get base deal number (D-YYXXXX format)
  SELECT deal_number INTO v_base_number
  FROM deals
  WHERE id = p_deal_id;

  IF v_base_number ~ '^D-\d{6}' THEN
    v_base_number := SUBSTRING(v_base_number FROM '^D-\d{6}');
  END IF;

  -- Get lead_client_id from deals
  SELECT lead_client_id INTO v_lead_client_id
  FROM deals
  WHERE id = p_deal_id;

  -- Get first traveler by order_index (lowest, non-lead preferred on tie)
  SELECT dt.client_id, CONCAT(c.first_name, ' ', c.last_name)
  INTO v_first_traveler_client_id, v_first_traveler_name
  FROM deal_travelers dt
  JOIN clients c ON c.id = dt.client_id
  WHERE dt.deal_id = p_deal_id
  ORDER BY dt.order_index ASC, (CASE WHEN dt.is_lead_traveler THEN 1 ELSE 0 END) ASC
  LIMIT 1;

  -- Get orderer name (from lead_client_id on deals, if different from first traveler)
  IF v_lead_client_id IS NOT NULL AND v_lead_client_id IS DISTINCT FROM v_first_traveler_client_id THEN
    SELECT CONCAT(first_name, ' ', last_name)
    INTO v_orderer_name
    FROM clients
    WHERE id = v_lead_client_id;
  END IF;

  -- Get country ISO code from destination
  SELECT co.iso_code INTO v_country_code
  FROM deals d
  JOIN destinations dest ON dest.id = d.destination_id
  JOIN countries co ON co.id = dest.country_id
  WHERE d.id = p_deal_id;

  -- Get hotel name from hotel service
  SELECT service_name INTO v_hotel_name
  FROM deal_services
  WHERE deal_id = p_deal_id
    AND service_type = 'hotel'
  LIMIT 1;

  -- Get formatted start date
  SELECT TO_CHAR(start_date, 'DD-MM-YYYY') INTO v_start_date
  FROM deals
  WHERE id = p_deal_id AND start_date IS NOT NULL;

  -- Build the display number
  v_deal_number := v_base_number;

  IF v_first_traveler_name IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_first_traveler_name;
  END IF;

  IF v_country_code IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_country_code;
  END IF;

  IF v_hotel_name IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_hotel_name;
  END IF;

  IF v_start_date IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_start_date;
  END IF;

  -- Append orderer in parentheses if different from first traveler
  IF v_orderer_name IS NOT NULL THEN
    v_deal_number := v_deal_number || ' (' || v_orderer_name || ')';
  END IF;

  -- Update the deal with new display number
  UPDATE deals SET deal_number = v_deal_number WHERE id = p_deal_id;

  RETURN v_deal_number;
END;
$function$;