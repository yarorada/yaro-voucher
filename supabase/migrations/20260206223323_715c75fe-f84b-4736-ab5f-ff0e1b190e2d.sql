
-- Create deal_payments table (similar to contract_payments)
CREATE TABLE public.deal_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL DEFAULT 'deposit',
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_payments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage payments on their own deals
CREATE POLICY "Users can view deal payments" ON public.deal_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_payments.deal_id AND deals.user_id = auth.uid())
  );

CREATE POLICY "Users can insert deal payments" ON public.deal_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_payments.deal_id AND deals.user_id = auth.uid())
  );

CREATE POLICY "Users can update deal payments" ON public.deal_payments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_payments.deal_id AND deals.user_id = auth.uid())
  );

CREATE POLICY "Users can delete deal payments" ON public.deal_payments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_payments.deal_id AND deals.user_id = auth.uid())
  );
