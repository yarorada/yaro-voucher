-- Peněženka klienta: Etapa 4 — storno zájezdu vrátí body do původního stavu.
-- Pravidla:
--   * Při přechodu deals.status → 'cancelled' (a pouze tehdy) vygenerujeme
--     reverzní transakce tak, aby netto dopad zájezdu na peněženku byl 0.
--   * Idempotentní — pokud už byly body vráceny (netto = 0), trigger neudělá nic.
--   * Reset wallet_points_used na 0 (doplatek je stejně stornovaný).
--   * wallet_points_earned_at zůstává beze změny → auto-earning job už deal znovu
--     nezpracuje.

CREATE OR REPLACE FUNCTION public.handle_deal_cancellation_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND COALESCE(OLD.status, '') <> 'cancelled' THEN

    -- 1) Reverse EARN: per klient netto = SUM(earn + reverse_earn) >= 0.
    --    Vložíme zápornou protihodnotu; netto po vložení = 0.
    INSERT INTO public.client_wallet_transactions
      (client_id, deal_id, points, kind, notes)
    SELECT
      t.client_id,
      NEW.id,
      -SUM(t.points),
      'reverse_earn',
      'Storno zájezdu — vrácení načtených bodů'
    FROM public.client_wallet_transactions t
    WHERE t.deal_id = NEW.id
      AND t.kind IN ('earn', 'reverse_earn')
    GROUP BY t.client_id
    HAVING SUM(t.points) > 0;

    -- 2) Reverse REDEEM: per klient netto = SUM(redeem + reverse_redeem) <= 0.
    --    Vložíme kladnou protihodnotu (vrátíme body).
    INSERT INTO public.client_wallet_transactions
      (client_id, deal_id, points, kind, notes)
    SELECT
      t.client_id,
      NEW.id,
      -SUM(t.points),
      'reverse_redeem',
      'Storno zájezdu — vrácení uplatněných bodů'
    FROM public.client_wallet_transactions t
    WHERE t.deal_id = NEW.id
      AND t.kind IN ('redeem', 'reverse_redeem')
    GROUP BY t.client_id
    HAVING SUM(t.points) < 0;

    -- 3) Sleva na doplatku už neplatí
    UPDATE public.deals
       SET wallet_points_used = 0
     WHERE id = NEW.id
       AND COALESCE(wallet_points_used, 0) <> 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_deal_cancellation_wallet ON public.deals;
CREATE TRIGGER trg_handle_deal_cancellation_wallet
  AFTER UPDATE OF status ON public.deals
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled')
  EXECUTE FUNCTION public.handle_deal_cancellation_wallet();

-- Backfill: již stornované dealy, které mají earn/redeem transakce bez reverse.
-- Spustíme jednorázově přes dočasný loop.
DO $$
DECLARE
  d RECORD;
BEGIN
  FOR d IN
    SELECT id
      FROM public.deals
     WHERE status = 'cancelled'
       AND EXISTS (
         SELECT 1 FROM public.client_wallet_transactions
          WHERE deal_id = deals.id
       )
  LOOP
    -- Reverse earn
    INSERT INTO public.client_wallet_transactions
      (client_id, deal_id, points, kind, notes)
    SELECT
      t.client_id, d.id, -SUM(t.points),
      'reverse_earn',
      'Storno zájezdu — backfill'
    FROM public.client_wallet_transactions t
    WHERE t.deal_id = d.id
      AND t.kind IN ('earn', 'reverse_earn')
    GROUP BY t.client_id
    HAVING SUM(t.points) > 0;

    -- Reverse redeem
    INSERT INTO public.client_wallet_transactions
      (client_id, deal_id, points, kind, notes)
    SELECT
      t.client_id, d.id, -SUM(t.points),
      'reverse_redeem',
      'Storno zájezdu — backfill'
    FROM public.client_wallet_transactions t
    WHERE t.deal_id = d.id
      AND t.kind IN ('redeem', 'reverse_redeem')
    GROUP BY t.client_id
    HAVING SUM(t.points) < 0;

    UPDATE public.deals
       SET wallet_points_used = 0
     WHERE id = d.id
       AND COALESCE(wallet_points_used, 0) <> 0;
  END LOOP;
END $$;
