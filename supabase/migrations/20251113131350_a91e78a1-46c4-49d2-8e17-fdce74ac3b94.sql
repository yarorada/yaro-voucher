-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Add document URLs field to clients table
ALTER TABLE public.clients 
ADD COLUMN document_urls jsonb DEFAULT '[]'::jsonb;

-- Create RLS policies for client documents bucket
CREATE POLICY "Authenticated users can upload client documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can view client documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can update client documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can delete client documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client-documents');