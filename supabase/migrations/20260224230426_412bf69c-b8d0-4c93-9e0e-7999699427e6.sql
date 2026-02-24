
CREATE TABLE public.accounting_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex') UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  year text,
  month text
);

ALTER TABLE public.accounting_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view accounting_shares" ON public.accounting_shares FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create accounting_shares" ON public.accounting_shares FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can delete accounting_shares" ON public.accounting_shares FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Public can read by token" ON public.accounting_shares FOR SELECT TO anon USING (true);
