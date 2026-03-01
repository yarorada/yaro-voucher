-- Regenerate deal numbers for all existing deals
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.deals LOOP
    PERFORM public.update_deal_display_number(r.id);
  END LOOP;
END;
$$;