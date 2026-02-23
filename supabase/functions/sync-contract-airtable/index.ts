import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
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
    const startDate = formatDate((contract.deal as any)?.start_date);
    const endDate = formatDate((contract.deal as any)?.end_date);
    const salesPrice = contract.total_price || 0;
    const currency = contract.currency || "CZK";
    const costPrice = ((contract.deal as any)?.deal_services || []).reduce(
      (sum: number, s: any) => sum + (s.cost_price || 0),
      0
    );
    const margin = salesPrice - costPrice;

    // Airtable API
    const airtableToken = Deno.env.get("AIRTABLE_API_TOKEN");
    const airtableBaseId = Deno.env.get("AIRTABLE_BASE_ID");
    const airtableTableId = Deno.env.get("AIRTABLE_TABLE_ID");

    if (!airtableToken || !airtableBaseId || !airtableTableId) {
      console.error("Missing Airtable configuration");
      return new Response(JSON.stringify({ error: "Missing Airtable configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}`;

    // Check if contract already exists in Airtable (by contract number)
    const searchUrl = `${airtableUrl}?filterByFormula={Číslo smlouvy}="${contract.contract_number}"`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json",
      },
    });

    const searchData = await searchResponse.json();
    const existingRecord = searchData.records?.[0];

    const fields: Record<string, any> = {
      "Číslo smlouvy": contract.contract_number,
      "Klient": clientName,
      "Email klienta": contract.client?.email || "",
      "Destinace": destination,
      "Prodejní cena": salesPrice,
      "Měna": currency,
      "Nákupní cena": costPrice,
      "Marže": margin,
      "Status": contract.status,
    };

    // Only include date fields if they have actual values (Airtable rejects empty strings for date fields)
    if (startDate) fields["Datum odjezdu"] = startDate;
    if (endDate) fields["Datum návratu"] = endDate;
    const sentDate = formatDate(contract.sent_at);
    if (sentDate) fields["Odesláno dne"] = sentDate;

    let airtableResponse: Response;

    if (existingRecord) {
      // Update existing record
      airtableResponse = await fetch(`${airtableUrl}/${existingRecord.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      });
    } else {
      // Create new record
      airtableResponse = await fetch(airtableUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      });
    }

    if (!airtableResponse.ok) {
      const errorBody = await airtableResponse.text();
      console.error("Airtable API error:", errorBody);
      return new Response(JSON.stringify({ error: "Airtable sync failed", details: errorBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await airtableResponse.json();
    console.log("Airtable sync successful:", result.id);

    return new Response(JSON.stringify({ success: true, recordId: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error syncing to Airtable:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
