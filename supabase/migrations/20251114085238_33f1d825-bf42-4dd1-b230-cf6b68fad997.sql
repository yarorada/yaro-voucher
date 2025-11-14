-- Add cost_price to deal_services and deal_variant_services
ALTER TABLE deal_services 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

ALTER TABLE deal_variant_services 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

-- Create view for deal profitability
CREATE OR REPLACE VIEW deal_profitability AS
SELECT 
  d.id as deal_id,
  d.deal_number,
  d.status,
  d.start_date,
  d.created_at,
  d.total_price as revenue,
  COALESCE(SUM(ds.cost_price * ds.person_count), 0) as total_costs,
  d.total_price - COALESCE(SUM(ds.cost_price * ds.person_count), 0) as profit,
  CASE 
    WHEN d.total_price > 0 THEN 
      ((d.total_price - COALESCE(SUM(ds.cost_price * ds.person_count), 0)) / d.total_price * 100)
    ELSE 0 
  END as profit_margin_percent,
  dt.client_id as lead_client_id
FROM deals d
LEFT JOIN deal_services ds ON ds.deal_id = d.id
LEFT JOIN deal_travelers dt ON dt.deal_id = d.id AND dt.is_lead_traveler = true
GROUP BY d.id, dt.client_id;

-- Grant access to authenticated users
GRANT SELECT ON deal_profitability TO authenticated;

-- Create table for analytics presets
CREATE TABLE IF NOT EXISTS user_analytics_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_analytics_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies for presets
CREATE POLICY "Users can view own presets" 
ON user_analytics_presets FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own presets" 
ON user_analytics_presets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets" 
ON user_analytics_presets FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets" 
ON user_analytics_presets FOR DELETE 
USING (auth.uid() = user_id);