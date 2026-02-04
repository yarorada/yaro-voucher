-- Add name column to deals table for custom deal names
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS name TEXT;