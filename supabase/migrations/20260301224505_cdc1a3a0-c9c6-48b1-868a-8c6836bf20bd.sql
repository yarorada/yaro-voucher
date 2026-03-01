-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'prodejce');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 5. CLIENTS: Prodejce sees only own records
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
CREATE POLICY "Users can view clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can update all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'))
  WITH CHECK (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can delete all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Users can delete clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

-- 6. DEALS: Prodejce sees only own records
DROP POLICY IF EXISTS "Authenticated users can view all deals" ON public.deals;
CREATE POLICY "Users can view deals"
  ON public.deals FOR SELECT
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can update all deals" ON public.deals;
CREATE POLICY "Users can update deals"
  ON public.deals FOR UPDATE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'))
  WITH CHECK (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can delete all deals" ON public.deals;
CREATE POLICY "Users can delete deals"
  ON public.deals FOR DELETE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

-- 7. TRAVEL_CONTRACTS: Prodejce sees only own records
CREATE POLICY "Users can view contracts"
  ON public.travel_contracts FOR SELECT
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

-- 8. VOUCHERS: Prodejce sees only own records
DROP POLICY IF EXISTS "Authenticated users can view all vouchers" ON public.vouchers;
CREATE POLICY "Users can view vouchers"
  ON public.vouchers FOR SELECT
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can update all vouchers" ON public.vouchers;
CREATE POLICY "Users can update vouchers"
  ON public.vouchers FOR UPDATE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'))
  WITH CHECK (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));

DROP POLICY IF EXISTS "Authenticated users can delete all vouchers" ON public.vouchers;
CREATE POLICY "Users can delete vouchers"
  ON public.vouchers FOR DELETE
  USING (auth.uid() = user_id OR NOT has_role(auth.uid(), 'prodejce'));