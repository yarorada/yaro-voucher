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

    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'Chybí payment_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Zpětná kompatibilita: dříve se posílala 'contract_payments', dnes pracujeme
    // výhradně s deal_payments. Akceptujeme obě hodnoty, ale tabulku contract_payments
    // už neaktualizujeme — je dormant a bude dropnuta.
    if (table && table !== 'deal_payments' && table !== 'contract_payments') {
      return new Response(JSON.stringify({ error: 'Neplatná tabulka' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const paidAtValue = paid_at || new Date().toISOString();

    // 1. Načti deal_payment
    const { data: dealPayment, error: fetchError } = await serviceClient
      .from('deal_payments')
      .select('id, deal_id, amount, payment_type')
      .eq('id', payment_id)
      .single();

    if (fetchError || !dealPayment) {
      throw new Error("Platba nebyla nalezena");
    }

    // 2. Označ deal_payment jako zaplacený
    const { error: updateError } = await serviceClient
      .from('deal_payments')
      .update({ paid: true, paid_at: paidAtValue })
      .eq('id', payment_id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Nepodařilo se aktualizovat platbu");
    }

    // 3. Posun stav dealu na 'confirmed' u první platby
    const dealId = dealPayment.deal_id;
    if (dealId) {
      const { data: currentDeal } = await serviceClient
        .from('deals')
        .select('status')
        .eq('id', dealId)
        .single();

      if (currentDeal && (currentDeal.status === 'inquiry' || currentDeal.status === 'quote')) {
        const { error: statusError } = await serviceClient
          .from('deals')
          .update({ status: 'confirmed' })
          .eq('id', dealId);

        if (statusError) {
          console.error("Deal status update error:", statusError);
        }
      }
    }

    // 4. Notifikace — pokud existuje smlouva přiřazená k dealu, odkážeme na ni
    let contractId: string | null = null;
    let contractNumber: string | null = null;
    try {
      if (dealId) {
        const { data: contract } = await serviceClient
          .from('travel_contracts')
          .select('id, contract_number')
          .eq('deal_id', dealId)
          .maybeSingle();
        if (contract) {
          contractId = contract.id;
          contractNumber = contract.contract_number;
        }
      }

      await serviceClient.from('notifications').insert({
        event_type: 'payment_confirmed',
        title: `Platba ${dealPayment.amount.toLocaleString('cs-CZ')} Kč spárována${contractNumber ? ` se smlouvou ${contractNumber}` : ''}`,
        contract_id: contractId,
        deal_id: dealId,
        link: dealId ? `/deals/${dealId}` : (contractId ? `/contracts/${contractId}` : null),
      });
    } catch (e) {
      console.error('Notification insert error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      deal_propagated: true,
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
