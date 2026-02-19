
-- Add image columns to hotel_templates
ALTER TABLE public.hotel_templates ADD COLUMN image_url text;
ALTER TABLE public.hotel_templates ADD COLUMN image_url_2 text;
ALTER TABLE public.hotel_templates ADD COLUMN image_url_3 text;

-- Add share_token to deals
ALTER TABLE public.deals ADD COLUMN share_token text UNIQUE;

-- Create hotel-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('hotel-images', 'hotel-images', true);

-- Storage policies for hotel-images bucket
CREATE POLICY "Anyone can view hotel images"
ON storage.objects FOR SELECT
USING (bucket_id = 'hotel-images');

CREATE POLICY "Authenticated users can upload hotel images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hotel-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update hotel images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'hotel-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete hotel images"
ON storage.objects FOR DELETE
USING (bucket_id = 'hotel-images' AND auth.role() = 'authenticated');
