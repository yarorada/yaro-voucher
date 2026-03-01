-- Update trigger to also react to lead_client_id changes
CREATE OR REPLACE FUNCTION public.trigger_update_deal_number_on_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'UPDATE' AND (
    OLD.destination_id IS DISTINCT FROM NEW.destination_id OR 
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.lead_client_id IS DISTINCT FROM NEW.lead_client_id
  )) THEN
    PERFORM update_deal_display_number(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;