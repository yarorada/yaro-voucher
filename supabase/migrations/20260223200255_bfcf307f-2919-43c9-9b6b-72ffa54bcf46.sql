
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  event_type text NOT NULL,
  title text NOT NULL,
  message text,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.travel_contracts(id) ON DELETE SET NULL,
  link text
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all notifications
CREATE POLICY "Authenticated users can view notifications"
ON public.notifications FOR SELECT
USING (auth.role() = 'authenticated'::text);

-- Authenticated users can update notifications (mark as read)
CREATE POLICY "Authenticated users can update notifications"
ON public.notifications FOR UPDATE
USING (auth.role() = 'authenticated'::text);

-- Only service role can insert (edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Authenticated users can delete notifications
CREATE POLICY "Authenticated users can delete notifications"
ON public.notifications FOR DELETE
USING (auth.role() = 'authenticated'::text);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
