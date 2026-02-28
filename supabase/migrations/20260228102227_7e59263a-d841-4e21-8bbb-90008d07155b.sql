-- Allow authenticated users to upload to voucher-pdfs bucket
CREATE POLICY "Authenticated users can upload voucher pdfs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voucher-pdfs' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete from voucher-pdfs (cleanup after send)
CREATE POLICY "Authenticated users can delete voucher pdfs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voucher-pdfs' AND
  auth.role() = 'authenticated'
);