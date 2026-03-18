
-- Helper function: checks if user has "all" data scope
-- Returns true if user should see all records (not just own)
CREATE OR REPLACE FUNCTION public.has_full_data_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_data_scope WHERE user_id = _user_id AND scope = 'all'
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.user_data_scope WHERE user_id = _user_id AND scope = 'own'
    ) THEN false
    -- No explicit row: use role default. admin/no-role -> all, prodejce -> own
    WHEN has_role(_user_id, 'prodejce'::app_role) THEN false
    ELSE true
  END;
$$;

-- =========================================================
-- DEALS
-- =========================================================
DROP POLICY IF EXISTS "Users can view deals" ON public.deals;
CREATE POLICY "Users can view deals"
ON public.deals
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can update deals" ON public.deals;
CREATE POLICY "Users can update deals"
ON public.deals
FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete deals" ON public.deals;
CREATE POLICY "Users can delete deals"
ON public.deals
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

-- =========================================================
-- VOUCHERS
-- =========================================================
DROP POLICY IF EXISTS "Users can view vouchers" ON public.vouchers;
CREATE POLICY "Users can view vouchers"
ON public.vouchers
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can update vouchers" ON public.vouchers;
CREATE POLICY "Users can update vouchers"
ON public.vouchers
FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete vouchers" ON public.vouchers;
CREATE POLICY "Users can delete vouchers"
ON public.vouchers
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

-- =========================================================
-- TRAVEL CONTRACTS
-- =========================================================
DROP POLICY IF EXISTS "Users can view own contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Authenticated users can view all contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Users can view contracts" ON public.travel_contracts;

CREATE POLICY "Users can view contracts"
ON public.travel_contracts
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Authenticated users can update all contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Users can update contracts" ON public.travel_contracts;

CREATE POLICY "Users can update contracts"
ON public.travel_contracts
FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Authenticated users can delete all contracts" ON public.travel_contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON public.travel_contracts;

CREATE POLICY "Users can delete contracts"
ON public.travel_contracts
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_full_data_scope(auth.uid())
);
