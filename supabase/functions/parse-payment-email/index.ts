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

    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== 'string' || emailText.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Vložte text emailové notifikace' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use AI to extract structured data from email
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a payment email parser for a Czech travel agency. Extract payment information from Czech bank notification emails. Always respond using the provided tool.`
          },
          {
            role: "user",
            content: `Extract payment details from this bank notification email:\n\n${emailText.slice(0, 3000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_payment",
              description: "Extract structured payment data from a bank email notification",
              parameters: {
                type: "object",
                properties: {
                  amount: { type: "number", description: "Payment amount in CZK" },
                  date: { type: "string", description: "Payment date in YYYY-MM-DD format" },
                  variable_symbol: { type: "string", description: "Variable symbol (variabilní symbol / VS)" },
                  sender_name: { type: "string", description: "Sender name (name of the person/company who sent the payment)" },
                  sender_account: { type: "string", description: "Sender bank account number if available" },
                  note: { type: "string", description: "Any payment note/message from sender" },
                },
                required: ["amount"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_payment" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'AI služba je přetížená, zkuste to znovu za chvíli' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Nedostatek kreditů pro AI službu' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", status, t);
      throw new Error("AI parsing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: 'AI nedokázala rozpoznat platební údaje z emailu' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log("Parsed payment data:", JSON.stringify(parsed));

    if (!parsed.amount || parsed.amount <= 0) {
      return new Response(JSON.stringify({ error: 'Nepodařilo se rozpoznat částku platby' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for matching unpaid payments — always in travel_contracts
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const matches: any[] = [];

    // Strategy 1: Search by variable symbol in contract_number
    if (parsed.variable_symbol) {
      const vs = parsed.variable_symbol.replace(/\D/g, '');

      // Find contracts where contract_number ends with this VS
      const { data: contracts } = await supabaseClient
        .from('travel_contracts')
        .select('id, contract_number, total_price, deal_id')
        .or(`contract_number.ilike.%${vs}`);

      if (contracts && contracts.length > 0) {
        for (const contract of contracts) {
          const { data: payments } = await supabaseClient
            .from('contract_payments')
            .select('id, amount, due_date, payment_type, notes, paid')
            .eq('contract_id', contract.id)
            .eq('paid', false)
            .order('due_date', { ascending: true });

          if (payments) {
            for (const payment of payments) {
              if (Math.abs(payment.amount - parsed.amount) <= 1) {
                matches.push({
                  table: 'contract_payments',
                  payment_id: payment.id,
                  payment_type: payment.payment_type,
                  payment_notes: payment.notes,
                  amount: payment.amount,
                  due_date: payment.due_date,
                  contract_number: contract.contract_number,
                  contract_id: contract.id,
                });
              }
            }
          }
        }
      }
    }

    // Strategy 2: If no VS match, search by amount across all unpaid contract_payments
    if (matches.length === 0) {
      const { data: allUnpaid } = await supabaseClient
        .from('contract_payments')
        .select('id, amount, due_date, payment_type, notes, paid, contract_id')
        .eq('paid', false)
        .order('due_date', { ascending: true });

      if (allUnpaid) {
        for (const payment of allUnpaid) {
          if (Math.abs(payment.amount - parsed.amount) <= 1) {
            // Get contract info
            const { data: contract } = await supabaseClient
              .from('travel_contracts')
              .select('contract_number, deal_id')
              .eq('id', payment.contract_id)
              .single();

            matches.push({
              table: 'contract_payments',
              payment_id: payment.id,
              payment_type: payment.payment_type,
              payment_notes: payment.notes,
              amount: payment.amount,
              due_date: payment.due_date,
              contract_number: contract?.contract_number,
              contract_id: payment.contract_id,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      parsed,
      matches,
      message: matches.length > 0
        ? `Nalezeno ${matches.length} odpovídajících plateb`
        : 'Nenalezena žádná odpovídající nezaplacená platba',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("parse-payment-email error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Nastala chyba při zpracování' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
