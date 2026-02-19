
-- Create deal_documents table for storing travel documents
CREATE TABLE public.deal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view deal documents"
  ON public.deal_documents FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create deal documents"
  ON public.deal_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete deal documents"
  ON public.deal_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for deal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-documents', 'deal-documents', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload deal documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view deal documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-documents');

CREATE POLICY "Authenticated users can delete deal documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');
