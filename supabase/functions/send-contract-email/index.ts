import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendContractEmailRequest {
  contractId: string;
  pdfPath?: string | null;
  ccSupplierEmail?: string | null;
  customEmailText?: string | null;
}

// Czech email text for client
const buildClientEmailText = (lastName: string, dateFrom: string, dateTo: string, destination: string) => {
  return `Vážený ${lastName},

posíláme vám cestovní smlouvu k vašemu zájezdu od ${dateFrom} do ${dateTo} do destinace ${destination}.

Prosíme o prostudování smlouvy a její podepsání.

S pozdravem,
YARO Travel - Váš specialista na dovolenou
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;
};

// English email text for supplier
const buildSupplierEmailText = (dateFrom: string, dateTo: string, destination: string) => {
  return `Dear valued partner,

we are sending you the travel contract for our clients for their trip from ${dateFrom} to ${dateTo} to ${destination}.

Please find the contract attached.

Best regards,
YARO Travel
Tel.: +420 602 102 108
zajezdy@yarotravel.cz`;
};

// Format date to DD.MM.YY
const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractId, pdfPath, ccSupplierEmail, customEmailText }: SendContractEmailRequest = await req.json();

    // Validate contractId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!contractId || !uuidRegex.test(contractId)) {
      return new Response(JSON.stringify({ error: "Invalid contract ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending contract email:", contractId, "by user:", user.id);

    // Use SERVICE_ROLE_KEY for data access
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract with client and deal info
    const { data: contract, error: contractError } = await supabase
      .from("travel_contracts")
      .select("*, client:clients(*), deal:deals(*, destination:destinations(name, country:countries(name)))")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract fetch error:", contractError);
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmail = contract.client?.email;
    const clientLastName = contract.client?.last_name || "klient";

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Client email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get dates and destination
    const dateFrom = contract.deal?.start_date ? formatDate(contract.deal.start_date) : "N/A";
    const dateTo = contract.deal?.end_date ? formatDate(contract.deal.end_date) : "N/A";
    const destination = contract.deal?.destination?.name || "N/A";

    // Prepare PDF attachment
    let pdfAttachment: any[] = [];
    if (pdfPath) {
      console.log("Downloading PDF from storage:", pdfPath);
      const { data: pdfData, error: pdfError } = await supabase.storage.from("voucher-pdfs").download(pdfPath);

      if (pdfError) {
        console.error("Error downloading PDF:", pdfError);
      } else if (pdfData) {
        const arrayBuffer = await pdfData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          for (let j = 0; j < chunk.length; j++) {
            binary += String.fromCharCode(chunk[j]);
          }
        }
        const base64 = btoa(binary);
        pdfAttachment = [{
          filename: `Smlouva_${contract.contract_number}.pdf`,
          content: base64,
        }];
        console.log("PDF attachment prepared, size:", arrayBuffer.byteLength, "bytes");
      }

      // Clean up temp PDF
      const { error: deleteError } = await supabase.storage.from("voucher-pdfs").remove([pdfPath]);
      if (deleteError) console.error("Error deleting temporary PDF:", deleteError);
    }

    const emailResults: { recipient: string; success: boolean; id?: string; error?: string }[] = [];
    const subject = `Cestovní smlouva ${contract.contract_number} - YARO Travel`;

    // Send to CLIENT (Czech) - use custom text if provided, otherwise use default
    const signature = `\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`;
    const clientEmailText = customEmailText
      ? customEmailText + signature
      : buildClientEmailText(clientLastName, dateFrom, dateTo, destination);
    console.log("Sending email to client:", clientEmail);

    const clientEmailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      bcc: ["zajezdy@yarotravel.cz"],
      subject,
      text: clientEmailText,
    };
    if (pdfAttachment.length > 0) {
      clientEmailPayload.attachments = pdfAttachment;
    }

    const clientResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientEmailPayload),
    });

    if (clientResponse.ok) {
      const clientResult = await clientResponse.json();
      emailResults.push({ recipient: clientEmail, success: true, id: clientResult.id });
    } else {
      const clientError = await clientResponse.json();
      console.error("Client email error:", clientError);
      emailResults.push({ recipient: clientEmail, success: false, error: JSON.stringify(clientError) });
    }

    // Send to SUPPLIER (English) if CC email provided
    if (ccSupplierEmail) {
      const supplierEmailText = buildSupplierEmailText(dateFrom, dateTo, destination);
      console.log("Sending email to supplier:", ccSupplierEmail);

      const supplierEmailPayload: any = {
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [ccSupplierEmail],
        bcc: ["zajezdy@yarotravel.cz"],
        subject,
        text: supplierEmailText,
      };
      if (pdfAttachment.length > 0) {
        supplierEmailPayload.attachments = pdfAttachment;
      }

      const supplierResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(supplierEmailPayload),
      });

      if (supplierResponse.ok) {
        const supplierResult = await supplierResponse.json();
        emailResults.push({ recipient: ccSupplierEmail, success: true, id: supplierResult.id });
      } else {
        const supplierError = await supplierResponse.json();
        console.error("Supplier email error:", supplierError);
        emailResults.push({ recipient: ccSupplierEmail, success: false, error: JSON.stringify(supplierError) });
      }
    }

    // Update sent_at on contract
    await supabase
      .from("travel_contracts")
      .update({ sent_at: new Date().toISOString(), status: contract.status === 'draft' ? 'sent' : contract.status })
      .eq("id", contractId);

    const allSuccessful = emailResults.every((r) => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        message: allSuccessful ? "Emails sent successfully" : "Some emails failed",
        recipients: emailResults.map((r) => r.recipient),
        results: emailResults,
        hasPdfAttachment: pdfAttachment.length > 0,
      }),
      {
        status: allSuccessful ? 200 : 207,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error sending contract email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
