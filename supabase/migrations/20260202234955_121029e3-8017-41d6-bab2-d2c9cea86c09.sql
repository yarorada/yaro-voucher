-- Add email settings columns to global_pdf_settings
ALTER TABLE public.global_pdf_settings 
ADD COLUMN IF NOT EXISTS email_send_pdf boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_subject_template text DEFAULT 'Travel Voucher {{voucher_code}} - YARO Travel',
ADD COLUMN IF NOT EXISTS email_cc_supplier boolean DEFAULT true;

-- Create storage bucket for voucher PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('voucher-pdfs', 'voucher-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for voucher-pdfs bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload voucher PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voucher-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own voucher PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'voucher-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own voucher PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'voucher-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role to read any file (for edge function)
CREATE POLICY "Service role can read all voucher PDFs"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'voucher-pdfs');