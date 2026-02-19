ALTER TABLE deal_services ADD COLUMN quantity integer NOT NULL DEFAULT 1;
ALTER TABLE deal_variant_services ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Copy existing person_count into quantity
UPDATE deal_services SET quantity = COALESCE(person_count, 1);
UPDATE deal_variant_services SET quantity = COALESCE(person_count, 1);