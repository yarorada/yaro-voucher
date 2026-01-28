-- Drop existing RLS policies on clients table
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;

-- Create new policies allowing any authenticated user to access all clients
CREATE POLICY "Authenticated users can view all clients" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create clients" 
ON public.clients 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all clients" 
ON public.clients 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all clients" 
ON public.clients 
FOR DELETE 
TO authenticated
USING (true);