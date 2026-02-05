-- Add 'dispatched' status to deal_status enum
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'dispatched';