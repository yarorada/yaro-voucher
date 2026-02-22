
-- Add new columns to hotel_templates for web integration
ALTER TABLE public.hotel_templates
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS nights text,
  ADD COLUMN IF NOT EXISTS green_fees text,
  ADD COLUMN IF NOT EXISTS price_label text,
  ADD COLUMN IF NOT EXISTS golf_courses text,
  ADD COLUMN IF NOT EXISTS benefits jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS room_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Add public read policy for hotel_templates (for the public API)
CREATE POLICY "Public can view published hotel_templates"
  ON public.hotel_templates
  FOR SELECT
  USING (is_published = true);
