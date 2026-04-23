-- Peněženka klienta: oprava výpočtu obratu letenek.
-- Služby v CRM používají details->>'price_mode' ('per_service' nebo 'per_person').
-- Letenky jsou typicky per_person → price × person_count (ne price × quantity).
-- Původní funkce násobila vždy quantity, takže letenky s per_person se počítaly
-- jen jako 1× price a zbytek obratu neoprávněně padl do bodů.
--
-- Fix: stejná logika jako v src/lib/servicePrice.ts.

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
    -- Součet letenek: price × (person_count pokud per_person, jinak quantity)
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
    IF v_non_flight <= 0 THEN
      UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    v_total_points := FLOOR(v_non_flight / 100)::INTEGER;
    IF v_total_points <= 0 THEN
      UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_payments
      FROM public.deal_payments
     WHERE deal_id = d.id;

    v_points_assigned := 0;

    IF v_total_payments > 0 THEN
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

    UPDATE public.deals SET wallet_points_earned_at = NOW() WHERE id = d.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_wallet_earnings(UUID) TO authenticated;

-- Přepočítání dealů, které už byly zpracovány se špatnou logikou.
-- Strategie: pro každý takový deal vytvoříme 'adjust' transakci, která vrátí
-- rozdíl mezi chybným a správným počtem bodů. Pokud byl chybný výpočet vyšší
-- (což je typické), odečteme; pokud byl nižší, přičteme.
--
-- Pozor: přesné rozdělení na jednotlivé klienty u dealů s splity je složité
-- (zaokrouhlovací zbytky šly objednateli). Pro bezpečnost přepočítáme jen
-- dealy, kde *všechny* dosavadní earn transakce šly objednateli
-- (bez splitů). Dealy se splity necháme manuálnímu přepočtu — méně běžné.

DO $$
DECLARE
  d RECORD;
  v_flight_sum_new NUMERIC;
  v_non_flight_new NUMERIC;
  v_points_new INTEGER;
  v_points_old INTEGER;
  v_diff INTEGER;
  v_distinct_clients INTEGER;
BEGIN
  FOR d IN
    SELECT de.id, de.client_id, de.total_price, de.deal_number
      FROM public.deals de
     WHERE de.wallet_points_earned_at IS NOT NULL
       AND de.client_id IS NOT NULL
       AND COALESCE(de.status, '') NOT IN ('cancelled')
  LOOP
    -- Ověř, že všechny earn transakce jdou jen na objednatele (bez splitů)
    SELECT COUNT(DISTINCT client_id) INTO v_distinct_clients
      FROM public.client_wallet_transactions
     WHERE deal_id = d.id
       AND kind = 'earn';

    IF v_distinct_clients <> 1 THEN
      CONTINUE; -- přeskočit dealy se splity (ručně)
    END IF;

    -- Správný výpočet
    SELECT COALESCE(SUM(
      COALESCE(price, 0) *
      CASE
        WHEN COALESCE(details->>'price_mode', 'per_service') = 'per_person'
          THEN COALESCE(person_count, 1)
        ELSE COALESCE(quantity, 1)
      END
    ), 0)
      INTO v_flight_sum_new
      FROM public.deal_services
     WHERE deal_id = d.id
       AND service_type = 'flight';

    v_non_flight_new := d.total_price - v_flight_sum_new;
    v_points_new := GREATEST(0, FLOOR(v_non_flight_new / 100)::INTEGER);

    -- Dosavadní součet earn − reverse_earn pro objednatele
    SELECT COALESCE(SUM(points), 0) INTO v_points_old
      FROM public.client_wallet_transactions
     WHERE deal_id = d.id
       AND client_id = d.client_id
       AND kind IN ('earn', 'reverse_earn');

    v_diff := v_points_new - v_points_old;

    IF v_diff <> 0 THEN
      INSERT INTO public.client_wallet_transactions
        (client_id, deal_id, points, kind, notes)
      VALUES (
        d.client_id,
        d.id,
        v_diff,
        'adjust',
        format(
          'Přepočet %s — oprava výpočtu letenek (per_person). Původně %s b, správně %s b.',
          COALESCE(d.deal_number, d.id::text),
          v_points_old,
          v_points_new
        )
      );
    END IF;
  END LOOP;
END $$;
