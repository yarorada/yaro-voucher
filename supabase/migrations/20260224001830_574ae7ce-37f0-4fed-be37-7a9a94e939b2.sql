
CREATE OR REPLACE VIEW public.deal_profitability AS
WITH deal_rates AS (
  -- Derive exchange rate per deal from services that have both cost_price and cost_price_original
  SELECT deal_id, 
    CASE WHEN SUM(CASE WHEN cost_price_original > 0 AND cost_price > 0 THEN 1 ELSE 0 END) > 0
    THEN SUM(CASE WHEN cost_price_original > 0 AND cost_price > 0 THEN cost_price ELSE 0 END) / 
         NULLIF(SUM(CASE WHEN cost_price_original > 0 AND cost_price > 0 THEN cost_price_original ELSE 0 END), 0)
    ELSE NULL END as exchange_rate
  FROM deal_services
  GROUP BY deal_id
),
service_revenue AS (
  -- Calculate per-service revenue in CZK
  SELECT ds.deal_id, ds.id as service_id,
    COALESCE(ds.price, 0) * 
    CASE WHEN (ds.details->>'price_mode') = 'per_person' THEN COALESCE(ds.person_count, 1)::numeric ELSE ds.quantity::numeric END *
    CASE 
      WHEN ds.price_currency IS NOT NULL AND ds.price_currency != 'CZK' 
           AND ds.cost_price_original > 0 AND ds.cost_price > 0 
        THEN ds.cost_price / ds.cost_price_original
      WHEN ds.price_currency IS NOT NULL AND ds.price_currency != 'CZK' AND dr.exchange_rate IS NOT NULL
        THEN dr.exchange_rate
      ELSE 1
    END as revenue_czk,
    COALESCE(ds.cost_price, 0) * 
    CASE WHEN (ds.details->>'price_mode') = 'per_person' THEN COALESCE(ds.person_count, 1)::numeric ELSE ds.quantity::numeric END as cost_czk
  FROM deal_services ds
  LEFT JOIN deal_rates dr ON dr.deal_id = ds.deal_id
)
SELECT 
  d.id AS deal_id,
  d.deal_number,
  d.status,
  d.start_date,
  d.created_at,
  CASE
    WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN 
      CASE WHEN d.currency IS NOT NULL AND d.currency != 'CZK' AND dr.exchange_rate IS NOT NULL
        THEN ROUND(d.total_price * dr.exchange_rate, 2)
        ELSE d.total_price
      END
    ELSE COALESCE(sr.sum_revenue, 0)
  END AS revenue,
  COALESCE(sr.sum_costs, 0) AS total_costs,
  CASE
    WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN 
      CASE WHEN d.currency IS NOT NULL AND d.currency != 'CZK' AND dr.exchange_rate IS NOT NULL
        THEN ROUND(d.total_price * dr.exchange_rate, 2)
        ELSE d.total_price
      END
    ELSE COALESCE(sr.sum_revenue, 0)
  END - COALESCE(sr.sum_costs, 0) AS profit,
  CASE
    WHEN CASE
      WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN 
        CASE WHEN d.currency IS NOT NULL AND d.currency != 'CZK' AND dr.exchange_rate IS NOT NULL
          THEN ROUND(d.total_price * dr.exchange_rate, 2)
          ELSE d.total_price
        END
      ELSE COALESCE(sr.sum_revenue, 0)
    END > 0 THEN
      (CASE
        WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN 
          CASE WHEN d.currency IS NOT NULL AND d.currency != 'CZK' AND dr.exchange_rate IS NOT NULL
            THEN ROUND(d.total_price * dr.exchange_rate, 2)
            ELSE d.total_price
          END
        ELSE COALESCE(sr.sum_revenue, 0)
      END - COALESCE(sr.sum_costs, 0)) / 
      CASE
        WHEN d.total_price IS NOT NULL AND d.total_price > 0 THEN 
          CASE WHEN d.currency IS NOT NULL AND d.currency != 'CZK' AND dr.exchange_rate IS NOT NULL
            THEN ROUND(d.total_price * dr.exchange_rate, 2)
            ELSE d.total_price
          END
        ELSE COALESCE(sr.sum_revenue, 0)
      END * 100
    ELSE 0
  END AS profit_margin_percent,
  dt.client_id AS lead_client_id
FROM deals d
LEFT JOIN (
  SELECT deal_id, SUM(revenue_czk) as sum_revenue, SUM(cost_czk) as sum_costs
  FROM service_revenue
  GROUP BY deal_id
) sr ON sr.deal_id = d.id
LEFT JOIN deal_travelers dt ON dt.deal_id = d.id AND dt.is_lead_traveler = true
LEFT JOIN deal_rates dr ON dr.deal_id = d.id;
