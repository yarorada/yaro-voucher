-- Add hotel_name column to vouchers table
ALTER TABLE public.vouchers 
ADD COLUMN IF NOT EXISTS hotel_name TEXT;

-- Update the voucher code generation function to use YT-RRNNN format
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  year_suffix TEXT;
  new_code TEXT;
BEGIN
  -- Get last two digits of current year
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get next number from sequence
  next_num := nextval('voucher_number_seq');
  
  -- Format as YT-RRNNN (e.g., YT-25001)
  new_code := 'YT-' || year_suffix || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_code;
END;
$function$;