-- Add RLS policies for voucher_counters to allow authenticated users to update
CREATE POLICY "Authenticated users can update voucher_counters" 
ON public.voucher_counters 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can insert voucher_counters" 
ON public.voucher_counters 
FOR INSERT 
WITH CHECK (true);