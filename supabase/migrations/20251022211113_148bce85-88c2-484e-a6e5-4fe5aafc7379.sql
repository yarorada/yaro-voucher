-- Create vouchers table with auto-incrementing counter
CREATE TABLE public.vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_code TEXT NOT NULL UNIQUE,
  voucher_number INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  other_travelers TEXT[], -- Array of other traveler names
  services JSONB NOT NULL, -- Array of service objects {name, date, time, provider, price}
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_vouchers_voucher_code ON public.vouchers(voucher_code);
CREATE INDEX idx_vouchers_client_name ON public.vouchers(client_name);
CREATE INDEX idx_vouchers_created_at ON public.vouchers(created_at DESC);

-- Create sequence for voucher numbers
CREATE SEQUENCE IF NOT EXISTS voucher_number_seq START WITH 1;

-- Function to generate next voucher code
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  new_code TEXT;
BEGIN
  -- Get next number from sequence
  next_num := nextval('voucher_number_seq');
  
  -- Format as YARO-XXXX (padded with zeros)
  new_code := 'YARO-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN new_code;
END;
$$;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamps
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read all vouchers (for public-facing feature)
CREATE POLICY "Anyone can view vouchers"
  ON public.vouchers
  FOR SELECT
  USING (true);

-- Allow anyone to create vouchers (for public-facing feature)
CREATE POLICY "Anyone can create vouchers"
  ON public.vouchers
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update vouchers (for management features)
CREATE POLICY "Anyone can update vouchers"
  ON public.vouchers
  FOR UPDATE
  USING (true);

-- Allow anyone to delete vouchers (for management features)
CREATE POLICY "Anyone can delete vouchers"
  ON public.vouchers
  FOR DELETE
  USING (true);