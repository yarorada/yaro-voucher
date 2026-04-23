-- Peněženka klienta: Etapa 2 — automatické načítání bodů po skončení zájezdu.
-- Pravidla:
--   * Obrat bez letenek = deal.total_price - SUM(deal_services.price * quantity WHERE service_type='flight')
--   * Body = FLOOR(obrat_bez_letenek / 50)
--   * Rozdělení:
--       - Split s client_id: body proporčně podle jeho částky v splitu
--       - Split jen s textem → objednateli (deals.client_id)
--       - Nerozdělený zbytek plateb → objednateli
--       - Deal bez splitů → 100 % objednateli
--   * Zaokrouhlovací zbytek bodů padá vždy objednateli
--   * Spouští se denně přes pg_cron; guard proti opakování = deals.wallet_points_earned_at

-- Vrací počet zpracovaných dealů. Volatelné ručně (backfill) i přes cron.
-- Parametr p_deal_id = pro zpracování konkrétního dealu (storno-handling, testing); NULL = všechny splňující podmínky.
CREATE OR REPLACE FUNCTION public.process_wallet_earnings(p_deal_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_flight_sum NUMERIC;
  v_non_flight NUMERIC;
  v_total_points INTEGER;
  v_total_payments NUMERIC;
  v_allocated_sum NUMERIC;
  v_points_assigned INTEGER;
  v_orderer_points INTEGER;
  v_rec RECORD;
  v_share_points INTEGER;
  v_count INTEGER := 0;
BEGIN
  FOR d IN
    SELECT id, client_id, total_price, end_date
      FROM public.deals
     WHERE (p_deal_id IS NULL OR id = p_deal_id)
       AND end_date IS NOT NULL
       AND end_date < CURRENT_DATE
       AND COALESCE(status, '') NOT IN ('cancelled')
       AND wallet_points_earned_at IS NULL
       AND client_id IS NOT NULL
       AND COALESCE(total_price, 0) > 0
  LOOP
    -- Součet flight služeb dealu
    SELECT COALESCE(SUM(COALESCE(price, 0) * COALESCE(quantity, 1)), 0)
      INTO v_flight_sum
      FROM public.deal_services
     WHERE deal_id = d.id
       AND service_type = 'flight';

    v_non_flight := d.total_price - v_flight_sum;
    IF v_non_flight <= 0 THEN
      -- Není co připsat, ale označíme jako zpracováno, aby se deal neopakoval
      UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    v_total_points := FLOOR(v_non_flight / 50)::INTEGER;
    IF v_total_points <= 0 THEN
      UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Celková suma plateb dealu (základ pro proporční rozdělení)
    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_payments
      FROM public.deal_payments
     WHERE deal_id = d.id;

    v_points_assigned := 0;

    IF v_total_payments > 0 THEN
      -- Pro každého klienta se splitem (client_id NOT NULL) sečíst jeho alokovanou částku
      FOR v_rec IN
        SELECT s.client_id, SUM(s.amount) AS paid_amount
          FROM public.deal_payment_splits s
          JOIN public.deal_payments p ON p.id = s.payment_id
         WHERE p.deal_id = d.id
           AND s.client_id IS NOT NULL
           AND s.client_id <> d.client_id  -- objednatelovy splity řešíme dohromady se zbytkem
         GROUP BY s.client_id
         HAVING SUM(s.amount) > 0
      LOOP
        v_share_points := FLOOR(v_total_points * (v_rec.paid_amount / v_total_payments))::INTEGER;
        IF v_share_points > 0 THEN
          INSERT INTO public.client_wallet_transactions (client_id, deal_id, points, kind, notes)
          VALUES (
            v_rec.client_id,
            d.id,
            v_share_points,
            'earn',
            format('Zájezd %s — podíl %s Kč', COALESCE((SELECT deal_number FROM public.deals WHERE id = d.id), d.id::text), v_rec.paid_amount)
          );
          v_points_assigned := v_points_assigned + v_share_points;
        END IF;
      END LOOP;
    END IF;

    -- Objednatel dostane zbytek (text-only splity + nerozdělené platby + zaokrouhlení)
    v_orderer_points := v_total_points - v_points_assigned;
    IF v_orderer_points > 0 THEN
      INSERT INTO public.client_wallet_transactions (client_id, deal_id, points, kind, notes)
      VALUES (
        d.client_id,
        d.id,
        v_orderer_points,
        'earn',
        format('Zájezd %s — obrat bez letenek %s Kč', COALESCE((SELECT deal_number FROM public.deals WHERE id = d.id), d.id::text), v_non_flight)
      );
    END IF;

    -- Guard proti opakování
    UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_wallet_earnings(UUID) TO authenticated;

-- Denní plánované spuštění přes pg_cron (03:00 UTC).
-- Pokud pg_cron není nainstalován, migrace projde bez chyby — cron pak řekneme Lovable
-- nebo se zapne extension via dashboard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Smaž starou instanci (pokud už existuje) a založ znova
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'process_wallet_earnings_daily';

    PERFORM cron.schedule(
      'process_wallet_earnings_daily',
      '0 3 * * *',  -- každý den 03:00 UTC
      $job$SELECT public.process_wallet_earnings(NULL);$job$
    );
  END IF;
END $$;
