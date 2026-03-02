
CREATE TABLE public.user_data_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_data_scope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data scope"
  ON public.user_data_scope FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own scope"
  ON public.user_data_scope FOR SELECT
  USING (auth.uid() = user_id);
