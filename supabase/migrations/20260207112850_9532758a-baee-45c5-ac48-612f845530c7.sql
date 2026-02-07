-- Add tee_times JSONB column to deals table for structured tee time storage
ALTER TABLE public.deals ADD COLUMN tee_times jsonb DEFAULT NULL;