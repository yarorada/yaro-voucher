ALTER TABLE public.invoices ADD COLUMN specific_symbol TEXT DEFAULT NULL;
ALTER TABLE public.invoices ADD COLUMN constant_symbol TEXT DEFAULT NULL;