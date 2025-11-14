-- Fix security definer view by explicitly setting security invoker
DROP VIEW IF EXISTS deal_profitability;

CREATE VIEW deal_profitability 
WITH (security_invoker = true)
AS
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