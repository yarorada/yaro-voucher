-- UCTO výstup — Etapa 1: zařadit smlouvy do dávek pro účetní
-- Smlouva se automaticky zařadí, jakmile přijde první platba.
-- Když se po archivaci změní cena, smlouva se znovu zařadí jako "změněná".

-- 1) Sloupce na travel_contracts ------------------------------------------------
ALTER TABLE public.travel_contracts
  ADD COLUMN IF NOT EXISTS accounting_batch_id uuid
    REFERENCES public.accounting_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_changed_after_archive boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_travel_contracts_accounting_queued
  ON public.travel_contracts (accounting_queued_at)
  WHERE accounting_batch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_travel_contracts_accounting_batch
  ON public.travel_contracts (accounting_batch_id)
  WHERE accounting_batch_id IS NOT NULL;

-- 2) Trigger: zařadit smlouvu při příchodu první platby ------------------------
CREATE OR REPLACE FUNCTION public.set_contract_queued_on_first_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.paid IS DISTINCT FROM TRUE) THEN
    UPDATE public.travel_contracts
       SET accounting_queued_at = COALESCE(accounting_queued_at, COALESCE(NEW.paid_at, NOW()))
     WHERE id = NEW.contract_id
       AND accounting_queued_at IS NULL
       AND accounting_batch_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_queued_on_first_payment ON public.contract_payments;
CREATE TRIGGER trg_set_contract_queued_on_first_payment
  AFTER INSERT OR UPDATE OF paid ON public.contract_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contract_queued_on_first_payment();

-- 3) Trigger: re-queue při změně ceny po archivaci -----------------------------
CREATE OR REPLACE FUNCTION public.flag_contract_changed_after_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_price IS DISTINCT FROM OLD.total_price
     AND OLD.accounting_batch_id IS NOT NULL
     AND NEW.accounting_batch_id IS NOT DISTINCT FROM OLD.accounting_batch_id THEN
    NEW.accounting_queued_at := NOW();
    NEW.accounting_changed_after_archive := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_contract_changed_after_archive ON public.travel_contracts;
CREATE TRIGGER trg_flag_contract_changed_after_archive
  BEFORE UPDATE OF total_price ON public.travel_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_contract_changed_after_archive();

-- 4) Backfill: smlouvy s alespoň jednou zaplacenou platbou ---------------------
UPDATE public.travel_contracts c
   SET accounting_queued_at = COALESCE(c.accounting_queued_at,
                                       (SELECT MIN(p.paid_at)
                                          FROM public.contract_payments p
                                         WHERE p.contract_id = c.id AND p.paid IS TRUE),
                                       NOW())
 WHERE c.accounting_queued_at IS NULL
   AND c.accounting_batch_id IS NULL
   AND EXISTS (SELECT 1 FROM public.contract_payments p
                WHERE p.contract_id = c.id AND p.paid IS TRUE);
