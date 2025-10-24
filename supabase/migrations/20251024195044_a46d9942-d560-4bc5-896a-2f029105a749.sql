-- Create a table for service templates
CREATE TABLE public.service_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all service_templates" 
ON public.service_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create service_templates" 
ON public.service_templates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update service_templates" 
ON public.service_templates 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete service_templates" 
ON public.service_templates 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_service_templates_updated_at
BEFORE UPDATE ON public.service_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();