
CREATE OR REPLACE VIEW public.deal_profitability AS
SELECT d.id AS deal_id,
    d.deal_number,
    d.status,
    d.start_date,
    d.created_at,
    d.total_price AS revenue,
    COALESCE(sum(COALESCE(ds.cost_price, 0) * ds.quantity::numeric), 0::numeric) AS total_costs,
    d.total_price - COALESCE(sum(COALESCE(ds.cost_price, 0) * ds.quantity::numeric), 0::numeric) AS profit,
        CASE
            WHEN d.total_price > 0::numeric THEN (d.total_price - COALESCE(sum(COALESCE(ds.cost_price, 0) * ds.quantity::numeric), 0::numeric)) / d.total_price * 100::numeric
            ELSE 0::numeric
        END AS profit_margin_percent,
    dt.client_id AS lead_client_id
   FROM deals d
     LEFT JOIN deal_services ds ON ds.deal_id = d.id
     LEFT JOIN deal_travelers dt ON dt.deal_id = d.id AND dt.is_lead_traveler = true
  GROUP BY d.id, dt.client_id;
