import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const formatDateIso = (dateString: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "Missing contractId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract with related data
    const { data: contract, error: contractError } = await supabase
      .from("travel_contracts")
      .select(`
        *,
        client:clients(first_name, last_name, email),
        deal:deals(
          start_date, end_date, currency,
          destination:destinations(name),
          deal_services(price, cost_price)
        )
      `)
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract not found:", contractError);
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = contract.client
      ? `${contract.client.first_name} ${contract.client.last_name}`
      : "";
    const destination = (contract.deal as any)?.destination?.name || "";
    const startDate = formatDateIso((contract.deal as any)?.start_date);
    const endDate = formatDateIso((contract.deal as any)?.end_date);
    const salesPrice = contract.total_price || 0;
    const currency = contract.currency || "CZK";
    const costPrice = ((contract.deal as any)?.deal_services || []).reduce(
      (sum: number, s: any) => sum + (s.cost_price || 0),
      0
    );
    const margin = salesPrice - costPrice;
    const sentDate = formatDateIso(contract.sent_at);

    // Google Sheets webhook
    const webhookUrl = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL");
    if (!webhookUrl) {
      console.error("Missing GOOGLE_SHEETS_WEBHOOK_URL");
      return new Response(JSON.stringify({ error: "Missing Google Sheets webhook configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, any> = {
      "Číslo smlouvy": contract.contract_number,
      "Klient": clientName,
      "Email klienta": contract.client?.email || "",
      "Destinace": destination,
      "Datum odjezdu": startDate,
      "Datum návratu": endDate,
      "Prodejní cena": salesPrice,
      "Měna": currency,
      "Nákupní cena": costPrice,
      "Marže": margin,
      "Odesláno dne": sentDate,
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorBody = await webhookResponse.text();
      console.error("Google Sheets webhook error:", errorBody);
      return new Response(JSON.stringify({ error: "Google Sheets sync failed", details: errorBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await webhookResponse.text();
    console.log("Google Sheets sync successful:", result);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error syncing to Google Sheets:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
