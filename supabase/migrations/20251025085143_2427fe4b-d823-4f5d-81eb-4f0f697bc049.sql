-- Create golf_club_templates table
CREATE TABLE IF NOT EXISTS public.golf_club_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.golf_club_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all golf_club_templates"
  ON public.golf_club_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create golf_club_templates"
  ON public.golf_club_templates
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update golf_club_templates"
  ON public.golf_club_templates
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete golf_club_templates"
  ON public.golf_club_templates
  FOR DELETE
  USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_golf_club_templates_updated_at
  BEFORE UPDATE ON public.golf_club_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();