-- Fix clients table RLS policy to restrict SELECT to only user's own clients
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;

-- Create restrictive policy - users can only view their own clients
CREATE POLICY "Users can view own clients" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id);

-- Also fix UPDATE and DELETE policies to be user-scoped
DROP POLICY IF EXISTS "Authenticated users can update all clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete all clients" ON public.clients;

CREATE POLICY "Users can update own clients" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" 
ON public.clients 
FOR DELETE 
USING (auth.uid() = user_id);