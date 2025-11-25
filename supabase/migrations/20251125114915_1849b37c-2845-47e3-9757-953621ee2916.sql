-- Create table for global PDF settings
CREATE TABLE IF NOT EXISTS public.global_pdf_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  font_size NUMERIC NOT NULL DEFAULT 10,
  logo_size NUMERIC NOT NULL DEFAULT 60,
  line_height NUMERIC NOT NULL DEFAULT 1.1,
  heading_size NUMERIC NOT NULL DEFAULT 17,
  section_spacing NUMERIC NOT NULL DEFAULT 4,
  content_padding NUMERIC NOT NULL DEFAULT 6,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.global_pdf_settings (font_size, logo_size, line_height, heading_size, section_spacing, content_padding)
VALUES (10, 60, 1.1, 17, 4, 6)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.global_pdf_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read the settings
CREATE POLICY "Anyone can view global PDF settings"
ON public.global_pdf_settings
FOR SELECT
USING (true);

-- Only authenticated users can update the settings
CREATE POLICY "Authenticated users can update global PDF settings"
ON public.global_pdf_settings
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_global_pdf_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_global_pdf_settings_timestamp
BEFORE UPDATE ON public.global_pdf_settings
FOR EACH ROW
EXECUTE FUNCTION update_global_pdf_settings_timestamp();