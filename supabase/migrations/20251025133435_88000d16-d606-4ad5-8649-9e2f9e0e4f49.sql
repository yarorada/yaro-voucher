-- Step 1: Add user_id columns as nullable first
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Get the first user ID to assign existing data
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user from auth.users
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  
  -- Update existing records with this user_id
  IF first_user_id IS NOT NULL THEN
    UPDATE vouchers SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE clients SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE suppliers SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- Step 3: Make columns NOT NULL with default
ALTER TABLE vouchers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE vouchers ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE clients ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE suppliers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Drop existing overly permissive policies for vouchers
DROP POLICY IF EXISTS "Authenticated users can view all vouchers" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can create vouchers" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can update vouchers" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can delete vouchers" ON vouchers;

-- Create user-scoped policies for vouchers
CREATE POLICY "Users can view own vouchers"
ON vouchers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vouchers"
ON vouchers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vouchers"
ON vouchers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vouchers"
ON vouchers FOR DELETE
USING (auth.uid() = user_id);

-- Drop existing overly permissive policies for clients
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

-- Create user-scoped policies for clients
CREATE POLICY "Users can view own clients"
ON clients FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
ON clients FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
ON clients FOR DELETE
USING (auth.uid() = user_id);

-- Drop existing overly permissive policies for suppliers
DROP POLICY IF EXISTS "Authenticated users can view all suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can create suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON suppliers;

-- Create user-scoped policies for suppliers
CREATE POLICY "Users can view own suppliers"
ON suppliers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own suppliers"
ON suppliers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
ON suppliers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
ON suppliers FOR DELETE
USING (auth.uid() = user_id);

-- Template tables remain shared with existing policies unchanged