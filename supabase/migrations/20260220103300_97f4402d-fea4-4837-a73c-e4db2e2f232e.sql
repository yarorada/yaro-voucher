
ALTER TABLE public.deals
ADD COLUMN auto_send_documents boolean NOT NULL DEFAULT false,
ADD COLUMN documents_auto_sent_at timestamp with time zone;
