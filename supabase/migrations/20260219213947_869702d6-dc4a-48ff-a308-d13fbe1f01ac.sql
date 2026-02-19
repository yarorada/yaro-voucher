
-- Function to check if user is the admin (radek@yarotravel.cz)
CREATE OR REPLACE FUNCTION public.is_task_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND email = 'radek@yarotravel.cz'
  )
$$;

-- Drop existing restrictive policies on tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- New SELECT: own tasks OR admin sees all
CREATE POLICY "Users can view tasks"
ON public.tasks FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_task_admin(auth.uid())
);

-- INSERT: anyone can create tasks for any user (to allow assigning)
CREATE POLICY "Authenticated users can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (true);

-- UPDATE: own tasks or admin
CREATE POLICY "Users can update tasks"
ON public.tasks FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.is_task_admin(auth.uid())
);

-- DELETE: own tasks or admin
CREATE POLICY "Users can delete tasks"
ON public.tasks FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_task_admin(auth.uid())
);
