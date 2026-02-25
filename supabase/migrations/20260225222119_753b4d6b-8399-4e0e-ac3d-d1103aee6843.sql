-- Fix contract numbers: restore proper CS-YYNNN format (3-digit zero-padded suffix)
UPDATE public.travel_contracts
SET contract_number = CASE
  WHEN contract_number = 'CS-251'  THEN 'CS-25001'
  WHEN contract_number = 'CS-261'  THEN 'CS-26001'
  WHEN contract_number = 'CS-262'  THEN 'CS-26002'
  WHEN contract_number = 'CS-2611' THEN 'CS-26011'
  WHEN contract_number = 'CS-2613' THEN 'CS-26013'
  WHEN contract_number = 'CS-2614' THEN 'CS-26014'
  ELSE contract_number
END
WHERE contract_number IN ('CS-251','CS-261','CS-262','CS-2611','CS-2613','CS-2614');