import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, pdfBase64 } = await req.json();

    if (!contractId || !pdfBase64) {
      return new Response(JSON.stringify({ error: 'contractId and pdfBase64 are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract with client and deal info
    const { data: contract, error: contractError } = await supabase
      .from("travel_contracts")
      .select("*, client:clients(first_name, last_name, email), deal:deals(start_date, end_date, destination:destinations(name))")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract fetch error:", contractError);
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientEmail = contract.client?.email;
    if (!clientEmail) {
      return new Response(JSON.stringify({ error: 'Client has no email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientLastName = contract.client?.last_name || "klient";
    const dateFrom = contract.deal?.start_date ? formatDate(contract.deal.start_date) : "N/A";
    const dateTo = contract.deal?.end_date ? formatDate(contract.deal.end_date) : "N/A";
    const destination = contract.deal?.destination?.name || "N/A";

    const emailText = `Vážený ${clientLastName},

děkujeme za podpis cestovní smlouvy na váš zájezd od ${dateFrom} do ${dateTo} do destinace ${destination}.

V příloze naleznete podepsanou smlouvu ve formátu PDF.

S pozdravem,
YARO Travel - Váš specialista na dovolenou
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;

    const subject = `Podepsaná smlouva ${contract.contract_number} - YARO Travel`;

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailPayload = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      bcc: ["zajezdy@yarotravel.cz"],
      subject,
      text: emailText,
      attachments: [{
        filename: `Smlouva_${contract.contract_number}_podepsana.pdf`,
        content: pdfBase64,
      }],
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errData = await emailResponse.json();
      console.error("Email send error:", errData);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: errData }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await emailResponse.json();
    console.log(`Signed contract PDF sent to ${clientEmail} for contract ${contractId}`);

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
