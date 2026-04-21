alter table public.suppliers
  add column if not exists invoice_email text;
