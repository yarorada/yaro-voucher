
-- Drop existing restrictive policies on deal_payments
DROP POLICY IF EXISTS "Users can insert deal payments" ON public.deal_payments;
DROP POLICY IF EXISTS "Users can view deal payments" ON public.deal_payments;
DROP POLICY IF EXISTS "Users can update deal payments" ON public.deal_payments;
DROP POLICY IF EXISTS "Users can delete deal payments" ON public.deal_payments;

-- Create permissive policies matching other deal tables (deal_services, deal_travelers)
CREATE POLICY "Authenticated users can view deal payments"
ON public.deal_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create deal payments"
ON public.deal_payments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal payments"
ON public.deal_payments FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deal payments"
ON public.deal_payments FOR DELETE
TO authenticated
USING (true);
