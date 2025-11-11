-- Add discount and adjustment fields to deals table
ALTER TABLE public.deals
ADD COLUMN discount_amount numeric DEFAULT 0,
ADD COLUMN adjustment_amount numeric DEFAULT 0,
ADD COLUMN discount_note text,
ADD COLUMN adjustment_note text;