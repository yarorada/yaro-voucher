ALTER TABLE hotel_templates
  ADD COLUMN destination_id uuid REFERENCES destinations(id) ON DELETE SET NULL;