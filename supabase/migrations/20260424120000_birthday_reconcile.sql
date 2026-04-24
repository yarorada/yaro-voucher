-- Birthday peněženka: reconcile stavu v produkci.
-- Migrace 20260424100000 se v produkční DB neaplikovala kompletně (BOOLEAN funkce
-- zůstala, no-arg nevznikla). Tahle migrace je idempotentní a dorovná stav.

-- 1) No-arg verze 1500 b, kind='earn' (připisuje + expiruje po 1 roce)
CREATE OR REPLACE FUNCTION public.process_birthday_bonuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INTEGER := 0;
  v_rec RECORD;
BEGIN
  INSERT INTO public.client_wallet_transactions (client_id, points, kind, notes)
  SELECT c.id, 1500, 'earn',
    'Narozeninový bonus ' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
  FROM public.clients c
  WHERE c.date_of_birth IS NOT NULL
    AND (
      (EXTRACT(MONTH FROM c.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM c.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE))
      OR (
        EXTRACT(MONTH FROM c.date_of_birth) = 2
        AND EXTRACT(DAY FROM c.date_of_birth) = 29
        AND EXTRACT(MONTH FROM CURRENT_DATE) = 2
        AND EXTRACT(DAY FROM CURRENT_DATE) = 28
        AND NOT (EXTRACT(YEAR FROM CURRENT_DATE)::int % 4 = 0
                 AND (EXTRACT(YEAR FROM CURRENT_DATE)::int % 100 <> 0
                      OR EXTRACT(YEAR FROM CURRENT_DATE)::int % 400 = 0))
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.client_wallet_transactions t
      WHERE t.client_id = c.id
        AND t.notes = 'Narozeninový bonus ' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
    );
  GET DIAGNOSTICS v_added = ROW_COUNT;

  FOR v_rec IN
    SELECT t.id, t.client_id, t.points, t.notes
      FROM public.client_wallet_transactions t
     WHERE t.kind = 'earn'
       AND t.notes LIKE 'Narozeninový bonus %'
       AND t.created_at <= NOW() - INTERVAL '1 year'
       AND NOT EXISTS (
         SELECT 1 FROM public.client_wallet_transactions r
         WHERE r.kind = 'reverse_earn'
           AND r.client_id = t.client_id
           AND r.notes = 'Expirace ' || t.notes
       )
  LOOP
    INSERT INTO public.client_wallet_transactions (client_id, points, kind, notes)
    VALUES (v_rec.client_id, -v_rec.points, 'reverse_earn', 'Expirace ' || v_rec.notes);
  END LOOP;

  RETURN v_added;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_birthday_bonuses() TO authenticated;

-- 2) Dropnout starou BOOLEAN verzi (100 b, kind='birthday')
DROP FUNCTION IF EXISTS public.process_birthday_bonuses(BOOLEAN);

-- 3) Cron joby: birthday na no-arg, úklid mrtvých (amnis/moneta)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed – skipping';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'process_birthday_bonuses_daily';

  PERFORM cron.schedule(
    'process_birthday_bonuses_daily',
    '30 2 * * *',
    $cron$ SELECT public.process_birthday_bonuses(); $cron$
  );

  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname IN ('amnis-fetch-transactions-daily', 'moneta-fetch-transactions-daily');
END $$;
