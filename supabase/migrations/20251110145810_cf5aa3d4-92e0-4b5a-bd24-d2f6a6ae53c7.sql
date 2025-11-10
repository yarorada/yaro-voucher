-- Create enums for deal and contract statuses
CREATE TYPE public.deal_status AS ENUM ('inquiry', 'quote', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.service_type AS ENUM ('flight', 'hotel', 'golf', 'transfer', 'insurance', 'other');
CREATE TYPE public.contract_status AS ENUM ('draft', 'sent', 'signed', 'cancelled');

-- Create countries table
CREATE TABLE public.countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  iso_code TEXT NOT NULL UNIQUE,
  currency TEXT,
  phone_prefix TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create destinations table
CREATE TABLE public.destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attractions table
CREATE TABLE public.attractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals table (obchodní případy)
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  deal_number TEXT NOT NULL UNIQUE,
  status public.deal_status NOT NULL DEFAULT 'inquiry',
  destination_id UUID REFERENCES public.destinations(id),
  start_date DATE,
  end_date DATE,
  total_price DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  deposit_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deal_travelers table (cestující v dealu)
CREATE TABLE public.deal_travelers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_lead_traveler BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deal_id, client_id)
);

-- Create deal_services table (služby v dealu)
CREATE TABLE public.deal_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  service_name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  start_date DATE,
  end_date DATE,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create travel_contracts table (cestovní smlouvy)
CREATE TABLE public.travel_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL UNIQUE,
  status public.contract_status NOT NULL DEFAULT 'draft',
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  total_price DECIMAL(10, 2) NOT NULL,
  deposit_amount DECIMAL(10, 2),
  payment_schedule JSONB,
  terms TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extend clients table with company fields
ALTER TABLE public.clients
ADD COLUMN company_name TEXT,
ADD COLUMN ico TEXT,
ADD COLUMN dic TEXT;

-- Extend vouchers table with deal_id
ALTER TABLE public.vouchers
ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for countries
CREATE POLICY "Authenticated users can view countries" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create countries" ON public.countries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update countries" ON public.countries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete countries" ON public.countries FOR DELETE TO authenticated USING (true);

-- RLS Policies for destinations
CREATE POLICY "Authenticated users can view destinations" ON public.destinations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create destinations" ON public.destinations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update destinations" ON public.destinations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete destinations" ON public.destinations FOR DELETE TO authenticated USING (true);

-- RLS Policies for attractions
CREATE POLICY "Authenticated users can view attractions" ON public.attractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create attractions" ON public.attractions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update attractions" ON public.attractions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete attractions" ON public.attractions FOR DELETE TO authenticated USING (true);

-- RLS Policies for deals
CREATE POLICY "Authenticated users can view all deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update all deals" ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete all deals" ON public.deals FOR DELETE TO authenticated USING (true);

-- RLS Policies for deal_travelers
CREATE POLICY "Authenticated users can view deal travelers" ON public.deal_travelers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create deal travelers" ON public.deal_travelers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deal travelers" ON public.deal_travelers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete deal travelers" ON public.deal_travelers FOR DELETE TO authenticated USING (true);

-- RLS Policies for deal_services
CREATE POLICY "Authenticated users can view deal services" ON public.deal_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create deal services" ON public.deal_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deal services" ON public.deal_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete deal services" ON public.deal_services FOR DELETE TO authenticated USING (true);

-- RLS Policies for travel_contracts
CREATE POLICY "Authenticated users can view all contracts" ON public.travel_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own contracts" ON public.travel_contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update all contracts" ON public.travel_contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete all contracts" ON public.travel_contracts FOR DELETE TO authenticated USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_destinations_updated_at BEFORE UPDATE ON public.destinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attractions_updated_at BEFORE UPDATE ON public.attractions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deal_services_updated_at BEFORE UPDATE ON public.deal_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_travel_contracts_updated_at BEFORE UPDATE ON public.travel_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate deal number
CREATE OR REPLACE FUNCTION public.generate_deal_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.deals
  WHERE deal_number LIKE 'D-' || v_year || '%';
  
  v_new_number := 'D-' || v_year || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_new_number;
END;
$$;

-- Create function to generate contract number
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.travel_contracts
  WHERE contract_number LIKE 'CS-' || v_year || '%';
  
  v_new_number := 'CS-' || v_year || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_new_number;
END;
$$;

-- Create trigger to auto-generate deal_number
CREATE OR REPLACE FUNCTION public.set_deal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_number IS NULL OR NEW.deal_number = '' THEN
    NEW.deal_number := generate_deal_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_deal_number_trigger
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_deal_number();

-- Create trigger to auto-generate contract_number
CREATE OR REPLACE FUNCTION public.set_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number := generate_contract_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_contract_number_trigger
BEFORE INSERT ON public.travel_contracts
FOR EACH ROW EXECUTE FUNCTION public.set_contract_number();

-- Create indexes for better performance
CREATE INDEX idx_destinations_country_id ON public.destinations(country_id);
CREATE INDEX idx_attractions_destination_id ON public.attractions(destination_id);
CREATE INDEX idx_deals_user_id ON public.deals(user_id);
CREATE INDEX idx_deals_destination_id ON public.deals(destination_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deal_travelers_deal_id ON public.deal_travelers(deal_id);
CREATE INDEX idx_deal_travelers_client_id ON public.deal_travelers(client_id);
CREATE INDEX idx_deal_services_deal_id ON public.deal_services(deal_id);
CREATE INDEX idx_deal_services_supplier_id ON public.deal_services(supplier_id);
CREATE INDEX idx_travel_contracts_user_id ON public.travel_contracts(user_id);
CREATE INDEX idx_travel_contracts_deal_id ON public.travel_contracts(deal_id);
CREATE INDEX idx_travel_contracts_client_id ON public.travel_contracts(client_id);
CREATE INDEX idx_vouchers_deal_id ON public.vouchers(deal_id);