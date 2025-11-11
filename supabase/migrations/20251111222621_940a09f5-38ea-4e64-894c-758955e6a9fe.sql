-- Update function to include hotel name in format: D-25NNN Jméno Příjmení CC Hotel DD-MM.RRRR
CREATE OR REPLACE FUNCTION public.update_deal_display_number(p_deal_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_number TEXT;
  v_lead_traveler_name TEXT;
  v_country_code TEXT;
  v_start_date TEXT;
  v_base_number TEXT;
  v_hotel_name TEXT;
BEGIN
  -- Get base deal number (D-25XXX format)
  SELECT deal_number INTO v_base_number
  FROM deals
  WHERE id = p_deal_id;
  
  -- Extract only the base number if it already contains additional info
  IF v_base_number ~ '^D-\d{6}' THEN
    v_base_number := SUBSTRING(v_base_number FROM '^D-\d{6}');
  END IF;
  
  -- Get lead traveler name
  SELECT CONCAT(c.first_name, ' ', c.last_name) INTO v_lead_traveler_name
  FROM deal_travelers dt
  JOIN clients c ON c.id = dt.client_id
  WHERE dt.deal_id = p_deal_id AND dt.is_lead_traveler = true
  LIMIT 1;
  
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
  
  -- Get formatted start date with dashes instead of dots
  SELECT TO_CHAR(start_date, 'DD-MM-YYYY') INTO v_start_date
  FROM deals
  WHERE id = p_deal_id AND start_date IS NOT NULL;
  
  -- Build the display number
  v_deal_number := v_base_number;
  
  IF v_lead_traveler_name IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_lead_traveler_name;
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
  
  -- Update the deal with new display number
  UPDATE deals SET deal_number = v_deal_number WHERE id = p_deal_id;
  
  RETURN v_deal_number;
END;
$$;

-- Create trigger for deal_services to update deal_number when hotel is added/changed
CREATE OR REPLACE FUNCTION public.trigger_update_deal_number_on_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if it's a hotel service
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.service_type = 'hotel' THEN
    PERFORM update_deal_display_number(NEW.deal_id);
  ELSIF TG_OP = 'DELETE' AND OLD.service_type = 'hotel' THEN
    PERFORM update_deal_display_number(OLD.deal_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger on deal_services
DROP TRIGGER IF EXISTS update_deal_number_on_service ON public.deal_services;
CREATE TRIGGER update_deal_number_on_service
AFTER INSERT OR UPDATE OR DELETE ON public.deal_services
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_deal_number_on_service();

-- Update all existing deals to new format
DO $$
DECLARE
  deal_record RECORD;
BEGIN
  FOR deal_record IN SELECT id FROM deals LOOP
    PERFORM update_deal_display_number(deal_record.id);
  END LOOP;
END;
$$;