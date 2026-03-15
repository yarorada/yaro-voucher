
-- Fix contract_payments RLS - allow all authenticated users (CRM is internal tool, same as deal_payments)
DROP POLICY IF EXISTS "Authenticated users can view contract_payments" ON public.contract_payments;
DROP POLICY IF EXISTS "Authenticated users can create contract_payments" ON public.contract_payments;
DROP POLICY IF EXISTS "Authenticated users can update contract_payments" ON public.contract_payments;
DROP POLICY IF EXISTS "Authenticated users can delete contract_payments" ON public.contract_payments;

CREATE POLICY "Authenticated users can view contract_payments"
  ON public.contract_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contract_payments"
  ON public.contract_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contract_payments"
  ON public.contract_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contract_payments"
  ON public.contract_payments FOR DELETE
  TO authenticated
  USING (true);
