-- Peněženka klienta: kompletní přepočet již načtených bodů.
-- Navazuje na 20260423240000 (fix per_person letenek). Zatímco tamní backfill
-- přepočítal jen dealy bez splitů, tato migrace přepočítá VŠECHNY zpracované
-- dealy včetně těch s vícečlenným rozdělením.
--
-- Strategie:
--   * Pro každý zpracovaný (wallet_points_earned_at IS NOT NULL, nezrušený) deal
--   * Vypočti správný v_total_points (obrat bez letenek / 100) s per_person logikou
--   * Rozdělení per klient podle stejných pravidel jako hlavní funkce:
--       - splity s client_id (mimo objednatele) → FLOOR(proportion)
--       - zbytek (včetně zaokrouhlení) → objednatel
--   * Dosavadní saldo klienta na dealu (SUM(points) WHERE kind IN earn,reverse_earn,adjust)
--     porovnej s novým správným podílem a vlož 'adjust' s rozdílem.
--   * redeem/reverse_redeem transakce (uplatnění) se NEdotýkají — ty jsou
--     správné a nesouvisí s výpočtem načítání.
--
-- Idempotence: při opakovaném spuštění vyjde diff = 0 → žádný další adjust.

DO $$
DECLARE
  d RECORD;
  v_flight_sum NUMERIC;
  v_non_flight NUMERIC;
  v_total_points INTEGER;
  v_total_payments NUMERIC;
  v_points_assigned INTEGER;
  v_orderer_new INTEGER;
  v_rec RECORD;
  v_share_points INTEGER;
  v_client_new INTEGER;
  v_client_old INTEGER;
  v_diff INTEGER;
  v_touched_clients UUID[];
BEGIN
  FOR d IN
    SELECT id, client_id, total_price, deal_number
      FROM public.deals
     WHERE wallet_points_earned_at IS NOT NULL
       AND client_id IS NOT NULL
       AND COALESCE(status, '') NOT IN ('cancelled')
       AND COALESCE(total_price, 0) > 0
  LOOP
    v_touched_clients := ARRAY[]::UUID[];

    -- 1) Správný obrat letenek (per_person aware)
    SELECT COALESCE(SUM(
      COALESCE(price, 0) *
      CASE
        WHEN COALESCE(details->>'price_mode', 'per_service') = 'per_person'
          THEN COALESCE(person_count, 1)
        ELSE COALESCE(quantity, 1)
      END
    ), 0)
      INTO v_flight_sum
      FROM public.deal_services
     WHERE deal_id = d.id
       AND service_type = 'flight';

    v_non_flight := d.total_price - v_flight_sum;
    v_total_points := GREATEST(0, FLOOR(v_non_flight / 100)::INTEGER);

    -- 2) Celkové platby (základ pro proporci)
    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_payments
      FROM public.deal_payments
     WHERE deal_id = d.id;

    v_points_assigned := 0;

    -- 3) Přepočet pro každého split-klienta
    IF v_total_payments > 0 AND v_total_points > 0 THEN
      FOR v_rec IN
        SELECT s.client_id, SUM(s.amount) AS paid_amount
          FROM public.deal_payment_splits s
          JOIN public.deal_payments p ON p.id = s.payment_id
         WHERE p.deal_id = d.id
           AND s.client_id IS NOT NULL
           AND s.client_id <> d.client_id
         GROUP BY s.client_id
         HAVING SUM(s.amount) > 0
      LOOP
        v_share_points := FLOOR(v_total_points * (v_rec.paid_amount / v_total_payments))::INTEGER;
        v_client_new := v_share_points;

        -- Dosavadní saldo klienta na dealu (earn + reverse_earn + adjust)
        SELECT COALESCE(SUM(points), 0) INTO v_client_old
          FROM public.client_wallet_transactions
         WHERE deal_id = d.id
           AND client_id = v_rec.client_id
           AND kind IN ('earn', 'reverse_earn', 'adjust');

        v_diff := v_client_new - v_client_old;
        IF v_diff <> 0 THEN
          INSERT INTO public.client_wallet_transactions
            (client_id, deal_id, points, kind, notes)
          VALUES (
            v_rec.client_id, d.id, v_diff, 'adjust',
            format('Přepočet %s — oprava podílu. Bylo %s b, má být %s b.',
              COALESCE(d.deal_number, d.id::text), v_client_old, v_client_new)
          );
        END IF;

        v_points_assigned := v_points_assigned + v_client_new;
        v_touched_clients := array_append(v_touched_clients, v_rec.client_id);
      END LOOP;
    END IF;

    -- 4) Objednatel = total − split podíly (zbytek + zaokrouhlení)
    v_orderer_new := GREATEST(0, v_total_points - v_points_assigned);

    SELECT COALESCE(SUM(points), 0) INTO v_client_old
      FROM public.client_wallet_transactions
     WHERE deal_id = d.id
       AND client_id = d.client_id
       AND kind IN ('earn', 'reverse_earn', 'adjust');

    v_diff := v_orderer_new - v_client_old;
    IF v_diff <> 0 THEN
      INSERT INTO public.client_wallet_transactions
        (client_id, deal_id, points, kind, notes)
      VALUES (
        d.client_id, d.id, v_diff, 'adjust',
        format('Přepočet %s — oprava výpočtu letenek (per_person). Bylo %s b, má být %s b.',
          COALESCE(d.deal_number, d.id::text), v_client_old, v_orderer_new)
      );
    END IF;

    -- 5) Pro případ, že dříve nějaký klient dostal body, ale dnes by neměl
    --    (nepatří už do splitů a není to ani objednatel) — vynulovat.
    FOR v_rec IN
      SELECT DISTINCT client_id
        FROM public.client_wallet_transactions
       WHERE deal_id = d.id
         AND kind IN ('earn', 'reverse_earn', 'adjust')
         AND client_id <> d.client_id
         AND NOT (client_id = ANY(v_touched_clients))
    LOOP
      SELECT COALESCE(SUM(points), 0) INTO v_client_old
        FROM public.client_wallet_transactions
       WHERE deal_id = d.id
         AND client_id = v_rec.client_id
         AND kind IN ('earn', 'reverse_earn', 'adjust');

      IF v_client_old <> 0 THEN
        INSERT INTO public.client_wallet_transactions
          (client_id, deal_id, points, kind, notes)
        VALUES (
          v_rec.client_id, d.id, -v_client_old, 'adjust',
          format('Přepočet %s — klient už nemá nárok (změna splitů).',
            COALESCE(d.deal_number, d.id::text))
        );
      END IF;
    END LOOP;

  END LOOP;
END $$;
