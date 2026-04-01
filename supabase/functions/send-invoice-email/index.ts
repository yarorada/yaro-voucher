import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, recipientEmail, customSubject, customBody } = await req.json();

    if (!invoiceId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing invoiceId or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = customSubject || `Faktura ${invoice.invoice_number || ""}`;
    const body = customBody || buildDefaultBody(invoice);

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const emailResponse = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: "YARO Travel <zajezdy@yarotravel.cz>",
        to: [recipientEmail],
        subject,
        html: body.replace(/\n/g, "<br>"),
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      return new Response(JSON.stringify({ error: "Failed to send email", details: emailResult }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDefaultBody(invoice: any): string {
  const amount = invoice.total_amount
    ? `${invoice.total_amount.toLocaleString("cs-CZ")} ${invoice.currency || "CZK"}`
    : "";
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("cs-CZ")
    : "";
  const vs = invoice.variable_symbol || "";

  return `Dobrý den,

zasíláme Vám fakturu č. ${invoice.invoice_number || ""}.

Částka: ${amount}
${vs ? `Variabilní symbol: ${vs}` : ""}
${dueDate ? `Datum splatnosti: ${dueDate}` : ""}
Bankovní účet: ${invoice.bank_account || "227993932/0600"}

S pozdravem,
YARO Travel
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;
}
