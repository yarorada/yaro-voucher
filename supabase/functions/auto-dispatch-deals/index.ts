import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];

    // Find deals that:
    // 1. Have status confirmed (not already dispatched/completed/cancelled)
    // 2. Have a travel contract
    // 3. All their services' end dates have passed
    const { data: candidates, error: fetchError } = await supabase
      .from("deals")
      .select(`
        id,
        deal_services(end_date, start_date),
        travel_contracts!travel_contracts_deal_id_fkey(id)
      `)
      .eq("status", "confirmed");

    if (fetchError) throw fetchError;

    const toDispatch: string[] = [];

    for (const deal of candidates || []) {
      // Must have at least one contract
      const contracts = deal.travel_contracts as any[];
      if (!contracts || contracts.length === 0) continue;

      // Must have at least one service
      const services = deal.deal_services as any[];
      if (!services || services.length === 0) continue;

      // Find the latest service date (end_date or start_date as fallback)
      const latestDate = services.reduce((latest: string | null, svc: any) => {
        const d = svc.end_date || svc.start_date;
        if (!d) return latest;
        if (!latest) return d;
        return d > latest ? d : latest;
      }, null);

      // If the latest service date has passed, mark for dispatch
      if (latestDate && latestDate < today) {
        toDispatch.push(deal.id);
      }
    }

    if (toDispatch.length > 0) {
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: "dispatched" })
        .in("id", toDispatch);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        dispatched: toDispatch.length,
        ids: toDispatch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
