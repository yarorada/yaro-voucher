-- Function to update deal_number with new format: D-25NNN Jméno Příjmení CC DD.MM.RRRR
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
BEGIN
  -- Get base deal number (D-25XXX format)
  SELECT deal_number INTO v_base_number
  FROM deals
  WHERE id = p_deal_id;
  
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
  
  -- Get formatted start date
  SELECT TO_CHAR(start_date, 'DD.MM.YYYY') INTO v_start_date
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
  
  IF v_start_date IS NOT NULL THEN
    v_deal_number := v_deal_number || ' ' || v_start_date;
  END IF;
  
  -- Update the deal with new display number
  UPDATE deals SET deal_number = v_deal_number WHERE id = p_deal_id;
  
  RETURN v_deal_number;
END;
$$;

-- Trigger function for deal_travelers to update deal_number when lead traveler is added
CREATE OR REPLACE FUNCTION public.trigger_update_deal_number_on_traveler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if it's the lead traveler
  IF (TG_OP = 'INSERT' AND NEW.is_lead_traveler = true) OR 
     (TG_OP = 'UPDATE' AND NEW.is_lead_traveler = true) THEN
    PERFORM update_deal_display_number(NEW.deal_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for deals to update deal_number when destination or start_date changes
CREATE OR REPLACE FUNCTION public.trigger_update_deal_number_on_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if destination_id or start_date changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.destination_id IS DISTINCT FROM NEW.destination_id OR 
    OLD.start_date IS DISTINCT FROM NEW.start_date
  )) THEN
    PERFORM update_deal_display_number(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_deal_number_on_traveler ON public.deal_travelers;
CREATE TRIGGER update_deal_number_on_traveler
AFTER INSERT OR UPDATE ON public.deal_travelers
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_deal_number_on_traveler();

DROP TRIGGER IF EXISTS update_deal_number_on_deal ON public.deals;
CREATE TRIGGER update_deal_number_on_deal
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_deal_number_on_deal();

-- Update existing deals to use new format
DO $$
DECLARE
  deal_record RECORD;
BEGIN
  FOR deal_record IN SELECT id FROM deals LOOP
    PERFORM update_deal_display_number(deal_record.id);
  END LOOP;
END;
$$;