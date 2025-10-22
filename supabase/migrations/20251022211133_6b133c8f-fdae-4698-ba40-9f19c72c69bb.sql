-- Fix security warnings by setting search_path on functions

-- Update generate_voucher_code function with secure search_path
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update update_updated_at_column function with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;