-- Enable RLS on voucher_counters table
ALTER TABLE public.voucher_counters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for voucher_counters
-- Only authenticated users can view counters (for reference)
CREATE POLICY "Authenticated users can view voucher_counters"
ON public.voucher_counters
FOR SELECT
TO authenticated
USING (true);

-- The trigger function runs as SECURITY DEFINER so it can update counters
-- No INSERT/UPDATE/DELETE policies needed for regular users