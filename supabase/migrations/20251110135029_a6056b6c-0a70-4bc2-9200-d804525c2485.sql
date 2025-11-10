-- Drop existing restrictive policies for vouchers
DROP POLICY IF EXISTS "Users can view own vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Users can update own vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Users can delete own vouchers" ON public.vouchers;

-- Drop existing restrictive policies for clients
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

-- Drop existing restrictive policies for suppliers
DROP POLICY IF EXISTS "Users can view own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete own suppliers" ON public.suppliers;

-- Create new policies allowing all authenticated users to view all data
-- Vouchers policies
CREATE POLICY "Authenticated users can view all vouchers"
ON public.vouchers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update all vouchers"
ON public.vouchers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all vouchers"
ON public.vouchers FOR DELETE
TO authenticated
USING (true);

-- Clients policies
CREATE POLICY "Authenticated users can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update all clients"
ON public.clients FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all clients"
ON public.clients FOR DELETE
TO authenticated
USING (true);

-- Suppliers policies
CREATE POLICY "Authenticated users can view all suppliers"
ON public.suppliers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update all suppliers"
ON public.suppliers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all suppliers"
ON public.suppliers FOR DELETE
TO authenticated
USING (true);