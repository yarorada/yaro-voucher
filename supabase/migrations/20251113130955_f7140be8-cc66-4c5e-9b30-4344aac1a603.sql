-- Add passport and ID card fields to clients table
ALTER TABLE public.clients 
ADD COLUMN passport_number text,
ADD COLUMN passport_expiry date,
ADD COLUMN id_card_number text,
ADD COLUMN id_card_expiry date;