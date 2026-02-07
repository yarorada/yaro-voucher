-- Add tee_times JSON column to travel_contracts
ALTER TABLE public.travel_contracts
ADD COLUMN tee_times jsonb DEFAULT NULL;