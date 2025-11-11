-- Create deal_variants table
CREATE TABLE public.deal_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  destination_id UUID REFERENCES public.destinations(id),
  start_date DATE,
  end_date DATE,
  total_price NUMERIC,
  notes TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid()
);

-- Enable RLS on deal_variants
ALTER TABLE public.deal_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_variants
CREATE POLICY "Authenticated users can view all deal_variants"
  ON public.deal_variants FOR SELECT
  USING (true);

CREATE POLICY "Users can create own deal_variants"
  ON public.deal_variants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update all deal_variants"
  ON public.deal_variants FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all deal_variants"
  ON public.deal_variants FOR DELETE
  USING (true);

-- Create deal_variant_services table
CREATE TABLE public.deal_variant_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.deal_variants(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  start_date DATE,
  end_date DATE,
  person_count INTEGER DEFAULT 1,
  price NUMERIC,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deal_variant_services
ALTER TABLE public.deal_variant_services ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_variant_services
CREATE POLICY "Authenticated users can view deal_variant_services"
  ON public.deal_variant_services FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create deal_variant_services"
  ON public.deal_variant_services FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal_variant_services"
  ON public.deal_variant_services FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deal_variant_services"
  ON public.deal_variant_services FOR DELETE
  USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_deal_variants_updated_at
  BEFORE UPDATE ON public.deal_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_variant_services_updated_at
  BEFORE UPDATE ON public.deal_variant_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to select a variant as final
CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id UUID;
  v_variant RECORD;
BEGIN
  -- Get the variant and deal_id
  SELECT * INTO v_variant
  FROM deal_variants
  WHERE id = p_variant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;
  
  v_deal_id := v_variant.deal_id;
  
  -- Unselect all other variants for this deal
  UPDATE deal_variants
  SET is_selected = false
  WHERE deal_id = v_deal_id AND id != p_variant_id;
  
  -- Select this variant
  UPDATE deal_variants
  SET is_selected = true
  WHERE id = p_variant_id;
  
  -- Copy variant data to main deal
  UPDATE deals
  SET 
    destination_id = v_variant.destination_id,
    start_date = v_variant.start_date,
    end_date = v_variant.end_date,
    total_price = v_variant.total_price
  WHERE id = v_deal_id;
  
  -- Delete existing deal services
  DELETE FROM deal_services WHERE deal_id = v_deal_id;
  
  -- Copy variant services to deal services
  INSERT INTO deal_services (
    deal_id,
    service_type,
    service_name,
    description,
    supplier_id,
    start_date,
    end_date,
    person_count,
    price,
    details
  )
  SELECT
    v_deal_id,
    service_type,
    service_name,
    description,
    supplier_id,
    start_date,
    end_date,
    person_count,
    price,
    details
  FROM deal_variant_services
  WHERE variant_id = p_variant_id;
  
  -- Update deal display number
  PERFORM update_deal_display_number(v_deal_id);
  
  RETURN true;
END;
$$;

-- Trigger to update deal number when variant is selected
CREATE OR REPLACE FUNCTION public.trigger_update_deal_number_on_variant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_selected = true AND (OLD.is_selected IS NULL OR OLD.is_selected = false) THEN
    PERFORM update_deal_display_number(NEW.deal_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_deal_number_on_variant_select
AFTER UPDATE ON public.deal_variants
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_deal_number_on_variant();