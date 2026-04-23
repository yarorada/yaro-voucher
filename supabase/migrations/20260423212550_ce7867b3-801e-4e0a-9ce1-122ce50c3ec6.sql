-- 20260423260000_wallet_birthday_bonus.sql
-- Birthday bonus: 100 points per client per year on their birthday

-- 0) Extend allowed kinds to include 'birthday'
ALTER TABLE public.client_wallet_transactions
  DROP CONSTRAINT IF EXISTS client_wallet_transactions_kind_check;

ALTER TABLE public.client_wallet_transactions
  ADD CONSTRAINT client_wallet_transactions_kind_check
  CHECK (kind = ANY (ARRAY['earn','redeem','reverse_earn','reverse_redeem','adjust','birthday']::text[]));

-- 1) Function: process_birthday_bonuses
CREATE OR REPLACE FUNCTION public.process_birthday_bonuses(p_backfill_year BOOLEAN DEFAULT FALSE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c RECORD;
  v_count INTEGER := 0;
  v_today DATE := CURRENT_DATE;
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_bday_this_year DATE;
  v_already_awarded BOOLEAN;
BEGIN
  FOR c IN
    SELECT id, date_of_birth
      FROM public.clients
     WHERE date_of_birth IS NOT NULL
  LOOP
    BEGIN
      v_bday_this_year := make_date(v_year, EXTRACT(MONTH FROM c.date_of_birth)::INT, EXTRACT(DAY FROM c.date_of_birth)::INT);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF p_backfill_year THEN
      IF v_bday_this_year > v_today THEN CONTINUE; END IF;
    ELSE
      IF v_bday_this_year <> v_today THEN CONTINUE; END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.client_wallet_transactions
       WHERE client_id = c.id
         AND kind = 'birthday'
         AND EXTRACT(YEAR FROM created_at) = v_year
    ) INTO v_already_awarded;

    IF v_already_awarded THEN CONTINUE; END IF;

    INSERT INTO public.client_wallet_transactions (client_id, points, kind, notes)
    VALUES (c.id, 100, 'birthday', format('Narozeninový bonus %s', v_year));

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_birthday_bonuses(BOOLEAN) TO authenticated, service_role;

-- 2) Schedule daily cron at 04:00 UTC if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'process_birthday_bonuses_daily';

    PERFORM cron.schedule(
      'process_birthday_bonuses_daily',
      '0 4 * * *',
      $cron$ SELECT public.process_birthday_bonuses(FALSE); $cron$
    );
  END IF;
END
$$;

-- 3) Backfill for the current year
SELECT public.process_birthday_bonuses(TRUE);
