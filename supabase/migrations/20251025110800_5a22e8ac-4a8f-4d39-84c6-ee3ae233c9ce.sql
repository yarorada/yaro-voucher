-- Create airline_templates table
CREATE TABLE public.airline_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.airline_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for airline_templates
CREATE POLICY "Authenticated users can view all airline_templates"
  ON public.airline_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create airline_templates"
  ON public.airline_templates
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update airline_templates"
  ON public.airline_templates
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete airline_templates"
  ON public.airline_templates
  FOR DELETE
  USING (true);

-- Create airport_templates table
CREATE TABLE public.airport_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iata TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.airport_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for airport_templates
CREATE POLICY "Authenticated users can view all airport_templates"
  ON public.airport_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create airport_templates"
  ON public.airport_templates
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update airport_templates"
  ON public.airport_templates
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete airport_templates"
  ON public.airport_templates
  FOR DELETE
  USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_airline_templates_updated_at
  BEFORE UPDATE ON public.airline_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_airport_templates_updated_at
  BEFORE UPDATE ON public.airport_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial airline data
INSERT INTO public.airline_templates (code, name) VALUES
  ('OK', 'Czech Airlines'),
  ('QS', 'Smartwings'),
  ('FR', 'Ryanair'),
  ('W6', 'Wizz Air'),
  ('U2', 'easyJet'),
  ('LH', 'Lufthansa'),
  ('OS', 'Austrian Airlines'),
  ('BA', 'British Airways'),
  ('AF', 'Air France'),
  ('KL', 'KLM'),
  ('TK', 'Turkish Airlines'),
  ('PC', 'Pegasus Airlines'),
  ('A3', 'Aegean Airlines'),
  ('EK', 'Emirates'),
  ('QR', 'Qatar Airways')
ON CONFLICT (code) DO NOTHING;

-- Insert initial airport data (most common ones)
INSERT INTO public.airport_templates (iata, city, name, country) VALUES
  ('PRG', 'Praha', 'Václav Havel Airport Prague', 'CZ'),
  ('BRQ', 'Brno', 'Brno-Tuřany Airport', 'CZ'),
  ('OSR', 'Ostrava', 'Leoš Janáček Airport', 'CZ'),
  ('PED', 'Pardubice', 'Pardubice Airport', 'CZ'),
  ('IST', 'Istanbul', 'Istanbul Airport', 'TR'),
  ('AYT', 'Antalya', 'Antalya Airport', 'TR'),
  ('DLM', 'Dalaman', 'Dalaman Airport', 'TR'),
  ('ATH', 'Athens', 'Athens International Airport', 'GR'),
  ('HER', 'Heraklion', 'Heraklion Airport', 'GR'),
  ('VIE', 'Vienna', 'Vienna International Airport', 'AT'),
  ('MUC', 'Munich', 'Munich Airport', 'DE'),
  ('FRA', 'Frankfurt', 'Frankfurt Airport', 'DE'),
  ('LHR', 'London', 'London Heathrow Airport', 'GB'),
  ('CDG', 'Paris', 'Charles de Gaulle Airport', 'FR'),
  ('AMS', 'Amsterdam', 'Amsterdam Schiphol Airport', 'NL')
ON CONFLICT (iata) DO NOTHING;