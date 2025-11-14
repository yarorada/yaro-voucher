-- 1. Rozšíření travel_contracts o informace o agentuře
ALTER TABLE travel_contracts 
ADD COLUMN IF NOT EXISTS agency_name text DEFAULT 'YARO Travel s.r.o.',
ADD COLUMN IF NOT EXISTS agency_address text,
ADD COLUMN IF NOT EXISTS agency_ico text,
ADD COLUMN IF NOT EXISTS agency_contact text;

-- 2. Tabulka pro rozpis plateb (zálohy, doplatky, splátky)
CREATE TABLE IF NOT EXISTS contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES travel_contracts(id) ON DELETE CASCADE NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('deposit', 'installment', 'final')),
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  paid boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. Tabulka pro přiřazení cestujících ke službám ve smlouvě
CREATE TABLE IF NOT EXISTS contract_service_travelers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES travel_contracts(id) ON DELETE CASCADE NOT NULL,
  service_type text NOT NULL,
  service_name text NOT NULL,
  client_id uuid REFERENCES clients(id) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Propojení voucher -> contract
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES travel_contracts(id);

-- 5. Enable RLS na nových tabulkách
ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_service_travelers ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies pro contract_payments
CREATE POLICY "Authenticated users can view contract_payments" 
ON contract_payments FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can create contract_payments" 
ON contract_payments FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can update contract_payments" 
ON contract_payments FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can delete contract_payments" 
ON contract_payments FOR DELETE 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

-- 7. RLS policies pro contract_service_travelers
CREATE POLICY "Authenticated users can view contract_service_travelers" 
ON contract_service_travelers FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can create contract_service_travelers" 
ON contract_service_travelers FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can update contract_service_travelers" 
ON contract_service_travelers FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);

CREATE POLICY "Authenticated users can delete contract_service_travelers" 
ON contract_service_travelers FOR DELETE 
USING (
  auth.uid() IN (
    SELECT user_id FROM travel_contracts WHERE id = contract_id
  )
);