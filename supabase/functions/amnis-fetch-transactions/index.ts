import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AMNIS_API_BASE = "https://api.amnistreasury.com";
const AMNIS_TOKEN_URL = `${AMNIS_API_BASE}/api/token`;
const AMNIS_TRANSACTIONS_URL = `${AMNIS_API_BASE}/api/transactions`;

async function getAmnisToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(AMNIS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amnis auth failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("No access_token in Amnis response");
  }
  return data.access_token;
}

interface AmnisTransaction {
  id: string;
  currency: string;
  amount: string;
  type: string;
  executionDate: string;
  executed: boolean;
  createdAt: string;
  account: number;
  comment?: string | null;
  tags?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AMNIS_CLIENT_ID = Deno.env.get("AMNIS_CLIENT_ID");
    const AMNIS_CLIENT_SECRET = Deno.env.get("AMNIS_CLIENT_SECRET");

    if (!AMNIS_CLIENT_ID || !AMNIS_CLIENT_SECRET) {
      return new Response(JSON.stringify({
        success: false,
        error: "AMNIS_CLIENT_ID nebo AMNIS_CLIENT_SECRET nejsou nakonfigurovány"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const daysBack: number = body.daysBack ?? 7;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const dateFromISO = dateFrom.toISOString();

    console.log(`Amnis: fetching payin transactions from ${dateFromISO}`);

    // Get OAuth token
    const accessToken = await getAmnisToken(AMNIS_CLIENT_ID, AMNIS_CLIENT_SECRET);

    // Fetch payin transactions
    const params = new URLSearchParams({
      type: "payin",
      executed: "true",
      "createdAt[gte]": dateFromISO,
      itemsPerPage: "50",
      "order[createdAt]": "DESC",
    });

    const txResponse = await fetch(`${AMNIS_TRANSACTIONS_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!txResponse.ok) {
      const text = await txResponse.text();
      throw new Error(`Amnis transactions API failed [${txResponse.status}]: ${text}`);
    }

    const transactions: AmnisTransaction[] = await txResponse.json();
    console.log(`Amnis: got ${transactions.length} payin transactions`);

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0, message: "Žádné nové platby z Amnis" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let inserted = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const externalId = `amnis-${tx.id}`;

      // Deduplication check
      const { data: existing } = await supabase
        .from("bank_notifications")
        .select("id")
        .eq("external_transaction_id", externalId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const amount = parseFloat(tx.amount);
      if (isNaN(amount) || amount <= 0) continue;

      const txDate = tx.executionDate || tx.createdAt;
      const parsedDate = txDate ? txDate.split("T")[0] : null;

      // Build notes from available fields
      const notesParts: string[] = [];
      if (tx.currency && tx.currency !== "CZK") {
        notesParts.push(`Měna: ${tx.currency}`);
      }
      if (tx.comment) {
        notesParts.push(tx.comment);
      }
      if (tx.tags && tx.tags.length > 0) {
        notesParts.push(tx.tags.join(", "));
      }
      const notes = notesParts.length > 0 ? notesParts.join(" — ") : null;

      // Try to match with contract payment by amount
      let matchedPaymentId: string | null = null;
      let matchedContractId: string | null = null;

      // Strategy 1: Match by exact amount (within 1 CZK tolerance)
      const { data: allUnpaid } = await supabase
        .from("contract_payments")
        .select("id, amount, contract_id")
        .eq("paid", false)
        .order("due_date", { ascending: true });

      if (allUnpaid) {
        const match = allUnpaid.find((p: { amount: number }) => Math.abs(p.amount - amount) <= 1);
        if (match) {
          matchedPaymentId = match.id;
          matchedContractId = match.contract_id;
        }
      }

      const { error: insertError } = await supabase
        .from("bank_notifications")
        .insert({
          raw_text: JSON.stringify(tx).slice(0, 5000),
          parsed_amount: amount,
          parsed_vs: null,
          parsed_date: parsedDate,
          matched_payment_id: matchedPaymentId,
          matched_contract_id: matchedContractId,
          status: "pending",
          notes: notes,
          external_transaction_id: externalId,
        });

      if (insertError) {
        console.error(`Amnis insert error for tx ${tx.id}:`, insertError);
      } else {
        inserted++;
        console.log(`Amnis: inserted tx ${tx.id}, amount=${amount}, match=${matchedPaymentId ? 'yes' : 'no'}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inserted,
      skipped,
      total: transactions.length,
      message: inserted > 0 ? `Načteno ${inserted} nových plateb z Amnis` : "Žádné nové platby k načtení",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("amnis-fetch-transactions error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Interní chyba",
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
