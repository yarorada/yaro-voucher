
DROP VIEW IF EXISTS public.deal_profitability;

CREATE VIEW public.deal_profitability AS
SELECT 
  d.id AS deal_id,
  d.deal_number,
  d.status,
  d.start_date,
  d.created_at,
  CASE 
    WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN d.total_price
    ELSE COALESCE(sum(COALESCE(ds.price, 0::numeric) * ds.quantity::numeric), 0::numeric)
  END AS revenue,
  COALESCE(sum(COALESCE(ds.cost_price, 0::numeric) * ds.quantity::numeric), 0::numeric) AS total_costs,
  CASE 
    WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN d.total_price
    ELSE COALESCE(sum(COALESCE(ds.price, 0::numeric) * ds.quantity::numeric), 0::numeric)
  END - COALESCE(sum(COALESCE(ds.cost_price, 0::numeric) * ds.quantity::numeric), 0::numeric) AS profit,
  CASE
    WHEN CASE 
      WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN d.total_price
      ELSE COALESCE(sum(COALESCE(ds.price, 0::numeric) * ds.quantity::numeric), 0::numeric)
    END > 0 THEN (
      CASE 
        WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN d.total_price
        ELSE COALESCE(sum(COALESCE(ds.price, 0::numeric) * ds.quantity::numeric), 0::numeric)
      END - COALESCE(sum(COALESCE(ds.cost_price, 0::numeric) * ds.quantity::numeric), 0::numeric)
    ) / CASE 
        WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN d.total_price
        ELSE COALESCE(sum(COALESCE(ds.price, 0::numeric) * ds.quantity::numeric), 0::numeric)
      END * 100
    ELSE 0
  END AS profit_margin_percent,
  dt.client_id AS lead_client_id
FROM deals d
LEFT JOIN deal_services ds ON ds.deal_id = d.id
LEFT JOIN deal_travelers dt ON dt.deal_id = d.id AND dt.is_lead_traveler = true
GROUP BY d.id, dt.client_id;
