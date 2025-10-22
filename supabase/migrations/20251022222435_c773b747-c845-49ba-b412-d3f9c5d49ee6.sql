-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policies for clients
CREATE POLICY "Authenticated users can view all clients" 
  ON public.clients 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create clients" 
  ON public.clients 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients" 
  ON public.clients 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Authenticated users can delete clients" 
  ON public.clients 
  FOR DELETE 
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create voucher_travelers junction table
CREATE TABLE public.voucher_travelers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_main_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(voucher_id, client_id)
);

-- Enable RLS on voucher_travelers
ALTER TABLE public.voucher_travelers ENABLE ROW LEVEL SECURITY;

-- Create policies for voucher_travelers
CREATE POLICY "Authenticated users can view all voucher_travelers" 
  ON public.voucher_travelers 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create voucher_travelers" 
  ON public.voucher_travelers 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update voucher_travelers" 
  ON public.voucher_travelers 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Authenticated users can delete voucher_travelers" 
  ON public.voucher_travelers 
  FOR DELETE 
  USING (true);

-- Add client_id to vouchers table
ALTER TABLE public.vouchers 
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_voucher_travelers_voucher_id ON public.voucher_travelers(voucher_id);
CREATE INDEX idx_voucher_travelers_client_id ON public.voucher_travelers(client_id);
CREATE INDEX idx_vouchers_client_id ON public.vouchers(client_id);
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_name ON public.clients(first_name, last_name);