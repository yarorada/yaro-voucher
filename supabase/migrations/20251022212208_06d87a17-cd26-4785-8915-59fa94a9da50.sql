-- Drop overly permissive public policies
DROP POLICY IF EXISTS "Anyone can view vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Anyone can create vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Anyone can update vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Anyone can delete vouchers" ON public.vouchers;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can view all vouchers"
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create vouchers"
  ON public.vouchers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vouchers"
  ON public.vouchers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete vouchers"
  ON public.vouchers
  FOR DELETE
  TO authenticated
  USING (true);