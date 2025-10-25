-- Create table to track voucher counters per year
CREATE TABLE IF NOT EXISTS public.voucher_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Drop the old sequence if it exists
DROP SEQUENCE IF EXISTS public.voucher_number_seq CASCADE;

-- Remove default value from voucher_code column
ALTER TABLE public.vouchers ALTER COLUMN voucher_code DROP DEFAULT;

-- Drop the old function
DROP FUNCTION IF EXISTS public.generate_voucher_code();

-- Create new function to generate voucher code based on issue date
CREATE OR REPLACE FUNCTION public.generate_voucher_code_for_year(p_issue_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year INTEGER;
  v_year_suffix TEXT;
  v_next_num INTEGER;
  v_new_code TEXT;
BEGIN
  -- Extract year from issue date
  v_year := EXTRACT(YEAR FROM p_issue_date);
  v_year_suffix := TO_CHAR(p_issue_date, 'YY');
  
  -- Get or create counter for this year
  INSERT INTO public.voucher_counters (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET last_number = voucher_counters.last_number + 1
  RETURNING last_number INTO v_next_num;
  
  -- Format as YT-YYNNN (e.g., YT-26001)
  v_new_code := 'YT-' || v_year_suffix || LPAD(v_next_num::TEXT, 3, '0');
  
  RETURN v_new_code;
END;
$$;

-- Create trigger function to auto-generate voucher code on insert
CREATE OR REPLACE FUNCTION public.set_voucher_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only generate if voucher_code is null or empty
  IF NEW.voucher_code IS NULL OR NEW.voucher_code = '' THEN
    NEW.voucher_code := generate_voucher_code_for_year(NEW.issue_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate voucher code before insert
DROP TRIGGER IF EXISTS set_voucher_code_trigger ON public.vouchers;
CREATE TRIGGER set_voucher_code_trigger
  BEFORE INSERT ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_voucher_code();

-- Reset all existing voucher codes to follow new format (optional - commented out)
-- You can uncomment this if you want to regenerate all existing voucher codes
/*
WITH numbered_vouchers AS (
  SELECT 
    id,
    issue_date,
    EXTRACT(YEAR FROM issue_date) as year,
    TO_CHAR(issue_date, 'YY') as year_suffix,
    ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM issue_date) ORDER BY created_at) as row_num
  FROM public.vouchers
)
UPDATE public.vouchers v
SET voucher_code = 'YT-' || nv.year_suffix || LPAD(nv.row_num::TEXT, 3, '0')
FROM numbered_vouchers nv
WHERE v.id = nv.id;

-- Update counters table based on existing vouchers
INSERT INTO public.voucher_counters (year, last_number)
SELECT 
  EXTRACT(YEAR FROM issue_date)::INTEGER as year,
  COUNT(*) as last_number
FROM public.vouchers
GROUP BY EXTRACT(YEAR FROM issue_date)
ON CONFLICT (year) 
DO UPDATE SET last_number = EXCLUDED.last_number;
*/