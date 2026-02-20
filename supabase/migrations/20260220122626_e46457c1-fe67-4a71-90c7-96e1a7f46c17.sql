
-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  trigger_type TEXT,
  trigger_offset_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_log table
CREATE TABLE public.email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.email_templates(id),
  deal_id UUID REFERENCES public.deals(id),
  contract_id UUID REFERENCES public.travel_contracts(id),
  voucher_id UUID REFERENCES public.vouchers(id),
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_templates (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view email_templates" ON public.email_templates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create email_templates" ON public.email_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update email_templates" ON public.email_templates FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete email_templates" ON public.email_templates FOR DELETE USING (true);

-- RLS policies for email_log
CREATE POLICY "Authenticated users can view email_log" ON public.email_log FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create email_log" ON public.email_log FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.email_templates (template_key, name, subject, body) VALUES
(
  'voucher_client_cz',
  'Voucher – klient (čeština)',
  'Travel Voucher {{voucher_code}} - YARO Travel',
  E'Vážený {{last_name}},\n\nposíláme vám voucher na služby k vašemu zájezdu od {{date_from}} do {{date_to}} do hotelu {{hotel}}.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz'
),
(
  'voucher_supplier_en',
  'Voucher – dodavatel (angličtina)',
  'Travel Voucher {{voucher_code}} - YARO Travel',
  E'Dear valued partner,\n\nwe are sending to you voucher for our clients for their stay from {{date_from}} to {{date_to}} at {{hotel}}.\n\nPlease find the voucher attached.\n\nBest regards,\nYARO Travel\nTel.: +420 602 102 108\nzajezdy@yarotravel.cz'
),
(
  'contract_client_cz',
  'Smlouva – klient (čeština)',
  'Cestovní smlouva {{contract_number}} - YARO Travel',
  E'Vážený {{last_name}},\n\nposíláme vám cestovní smlouvu k vašemu zájezdu od {{date_from}} do {{date_to}} do destinace {{destination}}.\n\nProsíme o prostudování smlouvy a její podepsání.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz'
),
(
  'contract_supplier_en',
  'Smlouva – dodavatel (angličtina)',
  'Travel Contract {{contract_number}} - YARO Travel',
  E'Dear valued partner,\n\nwe are sending you the travel contract for our clients for their trip from {{date_from}} to {{date_to}} to {{destination}}.\n\nPlease find the contract attached.\n\nBest regards,\nYARO Travel\nTel.: +420 602 102 108\nzajezdy@yarotravel.cz'
),
(
  'deal_docs_client_cz',
  'Dokumenty k dealu – klient',
  'Dokumenty k zájezdu - YARO Travel',
  E'Vážený {{last_name}},\n\nposíláme vám dokumenty k vašemu zájezdu.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz'
);
