-- Make the client-documents bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'client-documents';