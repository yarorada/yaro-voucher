
-- Create hotel_templates table
CREATE TABLE public.hotel_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotel_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view all hotel_templates"
  ON public.hotel_templates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create hotel_templates"
  ON public.hotel_templates FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update hotel_templates"
  ON public.hotel_templates FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete hotel_templates"
  ON public.hotel_templates FOR DELETE USING (true);
