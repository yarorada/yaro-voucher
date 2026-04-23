-- Peněženka klienta: narozeninový bonus
-- Pravidla:
--   * Klient s vyplněným date_of_birth dostane k narozeninám 1500 bodů (kind='earn').
--   * Bonus je platný 1 rok — následující narozeninový den se automaticky
--     odečte protitransakcí (kind='reverse_earn').
--   * Spouští se denně přes pg_cron; idempotence přes unikátní note pro daný rok.
--
-- Note format (slouží jako primární klíč pro idempotenci):
--   'Narozeninový bonus YYYY-MM-DD'        — připsání
--   'Expirace Narozeninový bonus YYYY-MM-DD' — odečet po 1 roce

CREATE OR REPLACE FUNCTION public.process_birthday_bonuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added INTEGER := 0;
  v_expired INTEGER := 0;
  v_rec RECORD;
BEGIN
  -- 1) Připsání klientům, kteří mají dnes narozeniny a ještě letošní bonus nedostali.
  --    Pro narozené 29. 2. v nepřestupném roce se bonus posune na 28. 2.
  INSERT INTO public.client_wallet_transactions
    (client_id, points, kind, notes)
  SELECT
    c.id,
    1500,
    'earn',
    'Narozeninový bonus ' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
  FROM public.clients c
  WHERE c.date_of_birth IS NOT NULL
    AND (
      (EXTRACT(MONTH FROM c.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM c.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE))
      OR (
        -- Náhradník pro 29. 2. v nepřestupném roce → připsat 28. 2.
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

  -- 2) Expirace: narozeninové bonusy starší 1 rok, které ještě nemají
  --    protitransakci — vložíme reverse_earn −1500.
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
    INSERT INTO public.client_wallet_transactions
      (client_id, points, kind, notes)
    VALUES (
      v_rec.client_id,
      -v_rec.points,
      'reverse_earn',
      'Expirace ' || v_rec.notes
    );
    v_expired := v_expired + 1;
  END LOOP;

  RETURN v_added;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_birthday_bonuses() TO authenticated;

-- Backfill: pro každého klienta s DOB přidělit bonus za poslední narozeniny
-- (pokud nastaly v posledních 365 dnech a ještě tento záznam nemá). Bonus dostane
-- created_at = datum narozenin → za ~rok se přirozeně sám vyexpiruje.
DO $$
DECLARE
  c RECORD;
  v_bday_year INTEGER;
  v_bday_date DATE;
BEGIN
  FOR c IN
    SELECT id, date_of_birth
      FROM public.clients
     WHERE date_of_birth IS NOT NULL
  LOOP
    BEGIN
      v_bday_year :=
        CASE
          WHEN make_date(
                 EXTRACT(YEAR FROM CURRENT_DATE)::int,
                 EXTRACT(MONTH FROM c.date_of_birth)::int,
                 LEAST(
                   EXTRACT(DAY FROM c.date_of_birth)::int,
                   EXTRACT(DAY FROM
                     (date_trunc('month', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                                                    EXTRACT(MONTH FROM c.date_of_birth)::int, 1))
                      + INTERVAL '1 month - 1 day')
                   )::int
                 )
               ) <= CURRENT_DATE
          THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
          ELSE (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int
        END;

      v_bday_date := make_date(
        v_bday_year,
        EXTRACT(MONTH FROM c.date_of_birth)::int,
        LEAST(
          EXTRACT(DAY FROM c.date_of_birth)::int,
          EXTRACT(DAY FROM
            (date_trunc('month', make_date(v_bday_year, EXTRACT(MONTH FROM c.date_of_birth)::int, 1))
             + INTERVAL '1 month - 1 day')
          )::int
        )
      );

      INSERT INTO public.client_wallet_transactions
        (client_id, points, kind, notes, created_at)
      SELECT
        c.id, 1500, 'earn',
        'Narozeninový bonus ' || to_char(v_bday_date, 'YYYY-MM-DD'),
        v_bday_date::timestamptz
      WHERE NOT EXISTS (
        SELECT 1 FROM public.client_wallet_transactions t
         WHERE t.client_id = c.id
           AND t.notes = 'Narozeninový bonus ' || to_char(v_bday_date, 'YYYY-MM-DD')
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip klienta s nevalidním datem narození (např. 0. x. xx)
      CONTINUE;
    END;
  END LOOP;
END $$;

-- Denní plánované spuštění přes pg_cron (02:30 UTC).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'process_birthday_bonuses_daily';

    PERFORM cron.schedule(
      'process_birthday_bonuses_daily',
      '30 2 * * *',
      $job$SELECT public.process_birthday_bonuses();$job$
    );
  END IF;
END $$;
