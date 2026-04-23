import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || req.headers.get('x-webhook-secret');
    const expectedToken = Deno.env.get('BANK_WEBHOOK_SECRET');

    if (!expectedToken || token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let parsed: { amount: number; variable_symbol?: string | null; date?: string | null; sender_name?: string | null; sender_account?: string | null; note?: string | null };
    let rawText: string;

    // Path 1: Structured data (e.g. from Google Sheets / Fintable)
    if (typeof body.amount === 'number' && body.amount > 0) {
      parsed = {
        amount: body.amount,
        variable_symbol: body.variable_symbol || null,
        date: body.date || null,
        sender_name: body.sender_name || null,
        sender_account: body.sender_account || null,
        note: body.note || null,
      };
      rawText = JSON.stringify(body);
      console.log("Webhook received structured data:", JSON.stringify(parsed));

    // Path 2: Raw email text → AI parsing (existing flow)
    } else {
      const emailText = body.emailText || body.body_plain || body.text || body.body || body.content || '';

      if (!emailText || typeof emailText !== 'string' || emailText.trim().length < 10) {
        return new Response(JSON.stringify({ error: 'No email text or structured data found in payload', received_keys: Object.keys(body) }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      rawText = emailText;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
                    sender_name: { type: "string", description: "Sender name" },
                    sender_account: { type: "string", description: "Sender bank account number" },
                    note: { type: "string", description: "Payment note/message" },
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
        const t = await aiResponse.text();
        console.error("AI error:", aiResponse.status, t);
        throw new Error("AI parsing failed");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error("AI could not parse payment data");
      }

      parsed = JSON.parse(toolCall.function.arguments);
      console.log("Webhook parsed payment:", JSON.stringify(parsed));

      if (!parsed.amount || parsed.amount <= 0) {
        return new Response(JSON.stringify({ error: 'Could not parse amount', parsed }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Search for matching contract payment
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let matchedPaymentId: string | null = null;
    let matchedContractId: string | null = null;

    // Strategy 1: Match by VS — najdi smlouvu podle contract_number a platbu v deal_payments dealu smlouvy
    if (parsed.variable_symbol) {
      const vs = parsed.variable_symbol.replace(/\D/g, '');

      const { data: contracts } = await supabase
        .from('travel_contracts')
        .select('id, contract_number, deal_id')
        .or(`contract_number.ilike.%${vs}`);

      if (contracts && contracts.length > 0) {
        for (const contract of contracts) {
          if (!contract.deal_id) continue;

          const { data: payments } = await supabase
            .from('deal_payments')
            .select('id, amount')
            .eq('deal_id', contract.deal_id)
            .eq('paid', false)
            .order('due_date', { ascending: true });

          if (payments) {
            const match = payments.find(p => Math.abs(p.amount - parsed.amount) <= 1);
            if (match) {
              matchedPaymentId = match.id;
              matchedContractId = contract.id;
              break;
            }
          }
        }
      }
    }

    // Strategy 2: Fallback podle částky v deal_payments
    if (!matchedPaymentId) {
      const { data: allUnpaid } = await supabase
        .from('deal_payments')
        .select('id, amount, deal_id')
        .eq('paid', false)
        .order('due_date', { ascending: true });

      if (allUnpaid) {
        const match = allUnpaid.find(p => Math.abs(p.amount - parsed.amount) <= 1);
        if (match) {
          matchedPaymentId = match.id;
          // Dohledej smlouvu patřící k dealu (pokud existuje)
          if (match.deal_id) {
            const { data: contract } = await supabase
              .from('travel_contracts')
              .select('id')
              .eq('deal_id', match.deal_id)
              .maybeSingle();
            matchedContractId = contract?.id || null;
          }
        }
      }
    }

    // Store notification
    const { data: notification, error: insertError } = await supabase
      .from('bank_notifications')
      .insert({
        raw_text: rawText.slice(0, 5000),
        parsed_amount: parsed.amount,
        parsed_vs: parsed.variable_symbol || null,
        parsed_date: parsed.date || null,
        matched_payment_id: matchedPaymentId,
        matched_contract_id: matchedContractId,
        status: 'pending',
        notes: [parsed.sender_name, parsed.note].filter(Boolean).join(' — ') || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to store notification");
    }

    console.log("Bank notification stored:", notification?.id, "match:", matchedPaymentId ? 'yes' : 'no');

    return new Response(JSON.stringify({
      success: true,
      notification_id: notification?.id,
      matched: !!matchedPaymentId,
      parsed_amount: parsed.amount,
      parsed_vs: parsed.variable_symbol,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("receive-bank-notification error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
