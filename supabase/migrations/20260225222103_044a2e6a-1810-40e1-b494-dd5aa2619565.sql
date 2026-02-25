-- Update existing contract numbers from CS-YYXXXXX (4-digit suffix) to CS-YYNNN (3-digit suffix)
UPDATE public.travel_contracts
SET contract_number = REGEXP_REPLACE(
  contract_number,
  '^(CS-)(\d{2})0+(\d{1,3})$',
  '\1\2\3'
)
WHERE contract_number ~ '^CS-\d{2}0\d+$';