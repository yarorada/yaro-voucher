
-- Fix the sync trigger: on INSERT, only add if not already present (avoid duplication with copy_deal_payments_to_contract trigger)
CREATE OR REPLACE FUNCTION public.sync_deal_payment_to_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id uuid;
  v_rows_updated integer;
  v_already_exists boolean;
BEGIN
  FOR v_contract_id IN
    SELECT id FROM public.travel_contracts WHERE deal_id = COALESCE(NEW.deal_id, OLD.deal_id)
  LOOP
    IF TG_OP = 'INSERT' THEN
      -- Check if a matching payment already exists (inserted by copy_deal_payments_to_contract trigger)
      SELECT EXISTS(
        SELECT 1 FROM public.contract_payments
        WHERE contract_id = v_contract_id
          AND payment_type = NEW.payment_type
          AND due_date = NEW.due_date
          AND amount = NEW.amount
      ) INTO v_already_exists;

      IF NOT v_already_exists THEN
        INSERT INTO public.contract_payments (
          contract_id, payment_type, amount, due_date, notes, paid, paid_at
        ) VALUES (
          v_contract_id,
          NEW.payment_type,
          NEW.amount,
          NEW.due_date,
          NEW.notes,
          COALESCE(NEW.paid, false),
          NEW.paid_at
        );
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- Best-effort match by type + old due_date + old amount
      UPDATE public.contract_payments
      SET
        payment_type = NEW.payment_type,
        amount       = NEW.amount,
        due_date     = NEW.due_date,
        notes        = NEW.notes,
        paid         = COALESCE(NEW.paid, false),
        paid_at      = NEW.paid_at
      WHERE contract_id = v_contract_id
        AND payment_type = OLD.payment_type
        AND due_date     = OLD.due_date
        AND amount       = OLD.amount;

      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

      -- Fallback: full re-sync if nothing matched
      IF v_rows_updated = 0 THEN
        DELETE FROM public.contract_payments WHERE contract_id = v_contract_id;
        INSERT INTO public.contract_payments (contract_id, payment_type, amount, due_date, notes, paid, paid_at)
        SELECT v_contract_id, dp.payment_type, dp.amount, dp.due_date, dp.notes, COALESCE(dp.paid, false), dp.paid_at
        FROM public.deal_payments dp
        WHERE dp.deal_id = NEW.deal_id
        ORDER BY dp.due_date;
      END IF;

    ELSIF TG_OP = 'DELETE' THEN
      -- Full re-sync from remaining deal payments
      DELETE FROM public.contract_payments WHERE contract_id = v_contract_id;
      INSERT INTO public.contract_payments (contract_id, payment_type, amount, due_date, notes, paid, paid_at)
      SELECT v_contract_id, dp.payment_type, dp.amount, dp.due_date, dp.notes, COALESCE(dp.paid, false), dp.paid_at
      FROM public.deal_payments dp
      WHERE dp.deal_id = OLD.deal_id
      ORDER BY dp.due_date;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;
