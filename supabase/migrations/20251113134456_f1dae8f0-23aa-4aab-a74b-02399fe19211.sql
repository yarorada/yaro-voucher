-- Add title column to clients table
ALTER TABLE public.clients
ADD COLUMN title text CHECK (title IN ('Pan', 'Paní'));