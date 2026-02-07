-- Allow authenticated users to upload PDFs to voucher-pdfs bucket
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voucher-pdfs');

-- Allow authenticated users to read their uploaded PDFs
CREATE POLICY "Authenticated users can read PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'voucher-pdfs');

-- Allow authenticated users to delete temporary PDFs
CREATE POLICY "Authenticated users can delete PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'voucher-pdfs');
