CREATE OR REPLACE FUNCTION public.process_wallet_earnings(_deal_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_deal record;
  v_points integer;
  v_net_revenue numeric;
BEGIN
  FOR v_deal IN
    SELECT d.id, d.lead_client_id, d.total_price, d.wallet_points_used, d.user_id
    FROM public.deals d
    WHERE d.status = 'completed'
      AND d.lead_client_id IS NOT NULL
      AND d.wallet_points_earned_at IS NULL
      AND COALESCE(d.total_price, 0) > 0
      AND (_deal_id IS NULL OR d.id = _deal_id)
  LOOP
    -- Net revenue = total_price - already redeemed wallet points
    v_net_revenue := COALESCE(v_deal.total_price, 0) - COALESCE(v_deal.wallet_points_used, 0);

    IF v_net_revenue <= 0 THEN
      UPDATE public.deals
        SET wallet_points_earned_at = NOW()
        WHERE id = v_deal.id;
      CONTINUE;
    END IF;

    -- Ratio 100:1 — 1 point per 100 CZK net revenue
    v_points := FLOOR(v_net_revenue / 100)::integer;

    IF v_points > 0 THEN
      INSERT INTO public.client_wallet_transactions
        (client_id, deal_id, kind, points, notes, created_by)
      VALUES
        (v_deal.lead_client_id, v_deal.id, 'earn', v_points,
         'Automaticky přičteno za dokončený obchod (poměr 100:1)', v_deal.user_id);
    END IF;

    UPDATE public.deals
      SET wallet_points_earned_at = NOW()
      WHERE id = v_deal.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;