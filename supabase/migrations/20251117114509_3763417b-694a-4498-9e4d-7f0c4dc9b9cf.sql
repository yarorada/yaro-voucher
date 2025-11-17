-- Drop existing RLS policies for voucher_travelers
DROP POLICY IF EXISTS "Users can create their own voucher travelers" ON voucher_travelers;
DROP POLICY IF EXISTS "Users can update their own voucher travelers" ON voucher_travelers;
DROP POLICY IF EXISTS "Users can delete their own voucher travelers" ON voucher_travelers;
DROP POLICY IF EXISTS "Users can view their own voucher travelers" ON voucher_travelers;

-- Create new policies that allow all authenticated users to manage all voucher_travelers
CREATE POLICY "Authenticated users can view all voucher travelers"
ON voucher_travelers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create voucher travelers"
ON voucher_travelers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update voucher travelers"
ON voucher_travelers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete voucher travelers"
ON voucher_travelers FOR DELETE
TO authenticated
USING (true);