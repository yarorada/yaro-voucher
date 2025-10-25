-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all voucher_travelers" ON public.voucher_travelers;
DROP POLICY IF EXISTS "Authenticated users can create voucher_travelers" ON public.voucher_travelers;
DROP POLICY IF EXISTS "Authenticated users can update voucher_travelers" ON public.voucher_travelers;
DROP POLICY IF EXISTS "Authenticated users can delete voucher_travelers" ON public.voucher_travelers;

-- Create security definer function to check voucher ownership
CREATE OR REPLACE FUNCTION public.is_voucher_owner(voucher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vouchers
    WHERE id = voucher_id
      AND user_id = auth.uid()
  )
$$;

-- Create secure RLS policies for voucher_travelers
CREATE POLICY "Users can view their own voucher travelers"
ON public.voucher_travelers
FOR SELECT
USING (public.is_voucher_owner(voucher_id));

CREATE POLICY "Users can create their own voucher travelers"
ON public.voucher_travelers
FOR INSERT
WITH CHECK (public.is_voucher_owner(voucher_id));

CREATE POLICY "Users can update their own voucher travelers"
ON public.voucher_travelers
FOR UPDATE
USING (public.is_voucher_owner(voucher_id))
WITH CHECK (public.is_voucher_owner(voucher_id));

CREATE POLICY "Users can delete their own voucher travelers"
ON public.voucher_travelers
FOR DELETE
USING (public.is_voucher_owner(voucher_id));