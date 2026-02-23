import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Chybí autorizace' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Neplatná autorizace' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { payment_id, paid_at, table } = await req.json();

    if (!payment_id || !table) {
      return new Response(JSON.stringify({ error: 'Chybí payment_id nebo table' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (table !== 'contract_payments') {
      return new Response(JSON.stringify({ error: 'Neplatná tabulka — párování probíhá vždy přes smlouvy' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const paidAtValue = paid_at || new Date().toISOString();

    // 1. Get the contract payment details before updating
    const { data: contractPayment, error: fetchError } = await serviceClient
      .from('contract_payments')
      .select('id, contract_id, amount, payment_type')
      .eq('id', payment_id)
      .single();

    if (fetchError || !contractPayment) {
      throw new Error("Platba nebyla nalezena");
    }

    // 2. Mark contract_payment as paid
    const { error: updateError } = await serviceClient
      .from('contract_payments')
      .update({ paid: true, paid_at: paidAtValue })
      .eq('id', payment_id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Nepodařilo se aktualizovat platbu");
    }

    // 3. Propagate to deal_payments if contract has a deal_id
    let dealPropagated = false;
    let dealId: string | null = null;

    const { data: contract } = await serviceClient
      .from('travel_contracts')
      .select('deal_id')
      .eq('id', contractPayment.contract_id)
      .single();

    if (contract?.deal_id) {
      dealId = contract.deal_id;

      // Find matching unpaid deal_payment by payment_type + amount (tolerance ±1)
      const { data: dealPayments } = await serviceClient
        .from('deal_payments')
        .select('id, amount, payment_type')
        .eq('deal_id', contract.deal_id)
        .eq('paid', false)
        .eq('payment_type', contractPayment.payment_type);

      if (dealPayments) {
        const matchingDealPayment = dealPayments.find(
          dp => Math.abs(dp.amount - contractPayment.amount) <= 1
        );

        if (matchingDealPayment) {
          const { error: dealUpdateError } = await serviceClient
            .from('deal_payments')
            .update({ paid: true, paid_at: paidAtValue })
            .eq('id', matchingDealPayment.id);

          if (dealUpdateError) {
            console.error("Deal payment update error:", dealUpdateError);
          } else {
            dealPropagated = true;
          }
        }
      }

      // Update deal status to "confirmed" when first payment arrives
      const { data: currentDeal } = await serviceClient
        .from('deals')
        .select('status')
        .eq('id', contract.deal_id)
        .single();

      if (currentDeal && (currentDeal.status === 'inquiry' || currentDeal.status === 'quote')) {
        const { error: statusError } = await serviceClient
          .from('deals')
          .update({ status: 'confirmed' })
          .eq('id', contract.deal_id);

        if (statusError) {
          console.error("Deal status update error:", statusError);
        }
      }
    }

    // Insert notification for payment confirmation
    try {
      const { data: contractInfo } = await serviceClient
        .from('travel_contracts')
        .select('contract_number')
        .eq('id', contractPayment.contract_id)
        .single();

      await serviceClient.from('notifications').insert({
        event_type: 'payment_confirmed',
        title: `Platba ${contractPayment.amount.toLocaleString('cs-CZ')} Kč spárována se smlouvou ${contractInfo?.contract_number || ''}`,
        contract_id: contractPayment.contract_id,
        deal_id: dealId,
        link: dealId ? `/deals/${dealId}` : `/contracts/${contractPayment.contract_id}`,
      });
    } catch (e) {
      console.error('Notification insert error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      deal_propagated: dealPropagated,
      deal_id: dealId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("confirm-payment-match error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Nastala chyba' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
