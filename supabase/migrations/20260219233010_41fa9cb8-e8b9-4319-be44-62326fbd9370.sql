
-- Add digital signing fields to travel_contracts
ALTER TABLE public.travel_contracts
  ADD COLUMN IF NOT EXISTS sign_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text;

-- Generate sign_token for existing contracts that don't have one
UPDATE public.travel_contracts
SET sign_token = encode(gen_random_bytes(24), 'hex')
WHERE sign_token IS NULL;

-- Create trigger to auto-generate sign_token on new contracts
CREATE OR REPLACE FUNCTION public.set_contract_sign_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sign_token IS NULL THEN
    NEW.sign_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_contract_sign_token
  BEFORE INSERT ON public.travel_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contract_sign_token();

-- Create storage bucket for signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-signatures', 'contract-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone can read signatures (needed for PDF embedding)
CREATE POLICY "Public can view signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-signatures');

-- Only service role inserts (edge function)
CREATE POLICY "Service role can upload signatures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contract-signatures');
