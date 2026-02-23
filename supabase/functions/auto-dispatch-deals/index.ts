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

    // === Phase 2: dispatched → completed ===
    // Deals that are "dispatched" and end_date has passed → completed
    const { data: dispatchedCandidates, error: fetchError2 } = await supabase
      .from("deals")
      .select(`id, deal_number, end_date, deal_services(end_date, start_date)`)
      .eq("status", "dispatched");

    if (fetchError2) throw fetchError2;

    const toComplete: string[] = [];

    for (const deal of dispatchedCandidates || []) {
      // Use deal.end_date first, otherwise find latest service date
      let latestDate = deal.end_date;
      if (!latestDate) {
        const services = deal.deal_services as any[];
        latestDate = (services || []).reduce((latest: string | null, svc: any) => {
          const d = svc.end_date || svc.start_date;
          if (!d) return latest;
          if (!latest) return d;
          return d > latest ? d : latest;
        }, null);
      }

      if (latestDate && latestDate < today) {
        toComplete.push(deal.id);
      }
    }

    if (toComplete.length > 0) {
      const { error: updateError2 } = await supabase
        .from("deals")
        .update({ status: "completed" })
        .in("id", toComplete);

      if (updateError2) throw updateError2;

      for (const dealId of toComplete) {
        const deal = dispatchedCandidates?.find((d: any) => d.id === dealId);
        try {
          await supabase.from("notifications").insert({
            event_type: "deal_status_changed",
            title: `Deal ${deal?.deal_number || dealId} automaticky přepnut na Dokončeno`,
            deal_id: dealId,
            link: `/deals/${dealId}`,
          });
        } catch (e) {
          console.error("Notification insert error:", e);
        }
      }
    }

    if (toDispatch.length > 0) {
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: "dispatched" })
        .in("id", toDispatch);

      if (updateError) throw updateError;

      for (const dealId of toDispatch) {
        try {
          const { data: dealInfo } = await supabase
            .from("deals")
            .select("deal_number")
            .eq("id", dealId)
            .single();

          await supabase.from("notifications").insert({
            event_type: "deal_status_changed",
            title: `Deal ${dealInfo?.deal_number || dealId} automaticky přepnut na Odbaveno`,
            deal_id: dealId,
            link: `/deals/${dealId}`,
          });
        } catch (e) {
          console.error("Notification insert error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        dispatched: toDispatch.length,
        completed: toComplete.length,
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
