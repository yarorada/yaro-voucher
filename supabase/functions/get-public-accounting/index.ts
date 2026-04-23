import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EU_COUNTRIES = [
  "Belgie", "Bulharsko", "Česko", "Dánsko", "Estonsko", "Finsko", "Francie",
  "Chorvatsko", "Irsko", "Itálie", "Kypr", "Litva", "Lotyšsko", "Lucembursko",
  "Maďarsko", "Malta", "Německo", "Nizozemsko", "Polsko", "Portugalsko",
  "Rakousko", "Rumunsko", "Řecko", "Slovensko", "Slovinsko", "Španělsko", "Švédsko",
];

const CANARY_EXCEPTIONS = ["Gran Canaria", "Tenerife", "Lanzarote", "Fuerteventura"];

function isInPreviousMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return d >= prev && d <= prevEnd;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate token
    const { data: share, error: shareError } = await supabase
      .from('accounting_shares')
      .select('*')
      .eq('share_token', token)
      .single();

    if (shareError || !share) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const year = share.year || String(new Date().getFullYear());
    const month = share.month || 'all';

    // Fetch contracts
    const { data: contracts, error } = await supabase
      .from('travel_contracts')
      .select(`
        id, contract_number, status, total_price, sent_at, signed_at,
        accounting_buy_final_override,
        client:clients!travel_contracts_client_id_fkey(first_name, last_name),
        deal:deals!travel_contracts_deal_id_fkey(
          id, start_date, end_date, total_price,
          destination:destinations!deals_destination_id_fkey(
            name,
            country:countries!destinations_country_id_fkey(name)
          )
        )
      `)
      .neq('status', 'cancelled')
      .order('contract_number', { ascending: true });

    if (error) throw error;
    if (!contracts) {
      return new Response(JSON.stringify({ rows: [], year, month }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dealIds = contracts.map((c: any) => (c.deal as any)?.id).filter(Boolean);

    const [{ data: allPayments }, { data: profitData }] = await Promise.all([
      supabase.from('deal_payments').select('deal_id, payment_type, amount, paid, paid_at').in('deal_id', dealIds),
      supabase.from('deal_profitability').select('deal_id, total_costs, revenue').in('deal_id', dealIds),
    ]);

    const profitMap = new Map((profitData || []).map((p: any) => [p.deal_id, p]));
    const paymentsByDeal = new Map<string, any[]>();
    (allPayments || []).forEach((p: any) => {
      const arr = paymentsByDeal.get(p.deal_id) || [];
      arr.push(p);
      paymentsByDeal.set(p.deal_id, arr);
    });
    const paymentsMap = new Map<string, any[]>();
    contracts.forEach((c: any) => {
      const dealId = (c.deal as any)?.id;
      if (dealId) paymentsMap.set(c.id, paymentsByDeal.get(dealId) || []);
    });

    const rows = contracts
      .map((c: any) => {
        const deal = c.deal as any;
        const client = c.client as any;
        const dest = deal?.destination as any;
        const countryName = dest?.country?.name || "";
        const destName = dest?.name || "";
        const startDate = deal?.start_date || null;
        const endDate = deal?.end_date || null;

        if (!startDate) return null;
        const sd = new Date(startDate);
        if (String(sd.getFullYear()) !== year) return null;
        if (month !== 'all' && String(sd.getMonth() + 1) !== month) return null;

        const prof = profitMap.get(deal?.id);
        const totalCosts = Number(prof?.total_costs || 0);
        const totalRevenue = Number(prof?.revenue || deal?.total_price || c.total_price || 0);

        const sellDeposit = totalRevenue;
        const buyDeposit = totalCosts;

        // Vyúčtování columns: show real values only if end date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPastTrip = endDate ? new Date(endDate) < today : false;

        const sellFinal = isPastTrip ? totalRevenue : 0;
        const buyFinalOverride = c.accounting_buy_final_override;
        const buyFinalCalc = buyFinalOverride != null ? Number(buyFinalOverride) : totalCosts;
        const buyFinal = isPastTrip ? buyFinalCalc : 0;

        const profitDeposit = sellDeposit - buyDeposit;
        const profitFinal = isPastTrip ? sellFinal - buyFinal : 0;

        const isEU = EU_COUNTRIES.includes(countryName);
        const isCanary = CANARY_EXCEPTIONS.some((ex) => destName.toLowerCase().includes(ex.toLowerCase()));
        const vatRate = isEU && !isCanary ? 0.21 : 0;

        const vatDeposit = Math.round(profitDeposit * vatRate);
        const vatFinal = isPastTrip ? Math.round(profitFinal * vatRate) : 0;
        const vatDiff = isPastTrip ? vatFinal - vatDeposit : 0;

        const firstPaidAt = (paymentsMap.get(c.id) || [])
          .filter((p: any) => p.paid && p.paid_at)
          .map((p: any) => p.paid_at!)
          .sort()[0] || null;

        const highlightRed = isInPreviousMonth(endDate);
        const highlightBlue = isInPreviousMonth(firstPaidAt);

        return {
          contractNumber: c.contract_number,
          clientName: client ? `${client.first_name} ${client.last_name}` : "",
          country: countryName,
          destination: destName,
          from: startDate,
          to: endDate,
          sellDeposit, buyDeposit, profitDeposit,
          sellFinal, buyFinal, profitFinal,
          vatDeposit, vatFinal, vatDiff,
          highlightRed, highlightBlue,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ rows, year, month }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
