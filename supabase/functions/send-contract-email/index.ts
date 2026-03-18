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

const buildClientEmailTextFallback = (salutation: string, dateFrom: string, dateTo: string, destination: string) => {
  return `${salutation},\n\nposíláme vám cestovní smlouvu k vašemu zájezdu od ${dateFrom} do ${dateTo} do destinace ${destination}.\n\nProsíme o prostudování smlouvy a její podepsání.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`;
};

const buildSupplierEmailTextFallback = (dateFrom: string, dateTo: string, destination: string) => {
  return `Dear valued partner,\n\nwe are sending you the travel contract for our clients for their trip from ${dateFrom} to ${dateTo} to ${destination}.\n\nPlease find the contract attached.\n\nBest regards,\nYARO Travel\nTel.: +420 602 102 108\nzajezdy@yarotravel.cz`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getFullYear()).slice(-2)}`;
};

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(val);
  }
  return result;
}

async function getTemplate(supabase: any, key: string) {
  const { data } = await supabase.from("email_templates").select("*").eq("template_key", key).eq("is_active", true).single();
  return data;
}

async function logEmail(supabase: any, params: { template_id?: string; contract_id?: string; recipient_email: string; status: string }) {
  try { await supabase.from("email_log").insert(params); } catch (e) { console.error("Failed to log email:", e); }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify token using service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractId, pdfPath, ccSupplierEmail, customEmailText, siteUrl }: SendContractEmailRequest & { siteUrl?: string } = await req.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!contractId || !uuidRegex.test(contractId)) {
      return new Response(JSON.stringify({ error: "Invalid contract ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseAdmin;

    const { data: contract, error: contractError } = await supabase
      .from("travel_contracts")
      .select("*, client:clients(*), deal:deals(*, destination:destinations(name, country:countries(name)))")
      .eq("id", contractId).single();

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmail = contract.client?.email;
    const clientLastName = contract.client?.last_name || "klient";
    const clientFirstName = contract.client?.first_name || "";
    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Client email not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateFrom = contract.deal?.start_date ? formatDate(contract.deal.start_date) : "N/A";
    const dateTo = contract.deal?.end_date ? formatDate(contract.deal.end_date) : "N/A";
    const destination = contract.deal?.destination?.name || "N/A";

    const signToken = (contract as any).sign_token;
    const baseUrl = siteUrl || "https://yarogolf-crm.lovable.app";
    const signLink = signToken ? `${baseUrl}/sign-contract?token=${signToken}` : "";

    const placeholderVars: Record<string, string> = {
      first_name: clientFirstName,
      last_name: clientLastName,
      destination,
      hotel: "",
      date_from: dateFrom,
      date_to: dateTo,
      total_price: contract.total_price?.toString() || "",
      voucher_code: "",
      contract_number: contract.contract_number,
      sign_link: signLink,
    };

    // Load templates
    const clientTemplate = await getTemplate(supabase, "contract_client_cz");
    const supplierTemplate = await getTemplate(supabase, "contract_supplier_en");

    const subject = clientTemplate
      ? replacePlaceholders(clientTemplate.subject, placeholderVars)
      : `Cestovní smlouva ${contract.contract_number} - YARO Travel`;

    // Prepare PDF
    let pdfAttachment: any[] = [];
    if (pdfPath) {
      const { data: pdfData, error: pdfError } = await supabase.storage.from("voucher-pdfs").download(pdfPath);
      if (!pdfError && pdfData) {
        const arrayBuffer = await pdfData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
        }
        pdfAttachment = [{ filename: `Smlouva_${contract.contract_number}.pdf`, content: btoa(binary) }];
      }
      await supabase.storage.from("voucher-pdfs").remove([pdfPath]);
    }

    const emailResults: { recipient: string; success: boolean; id?: string; error?: string }[] = [];

    // Build client email text
    const signLinkText = signLink ? `\n\n📝 Smlouvu můžete podepsat online zde:\n${signLink}` : "";
    const signature = `\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`;
    const attachmentNote = pdfAttachment.length > 0 ? `\n\nV příloze naleznete smlouvu ve formátu PDF.` : "";

    let clientEmailText: string;
    if (customEmailText) {
      clientEmailText = customEmailText + signLinkText + signature + attachmentNote;
    } else if (clientTemplate) {
      clientEmailText = replacePlaceholders(clientTemplate.body, placeholderVars) + signLinkText + attachmentNote;
    } else {
      clientEmailText = buildClientEmailTextFallback(clientLastName, dateFrom, dateTo, destination) + signLinkText + attachmentNote;
    }

    const clientEmailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      bcc: ["zajezdy@yarotravel.cz"],
      subject,
      text: clientEmailText,
    };
    if (pdfAttachment.length > 0) clientEmailPayload.attachments = pdfAttachment;

    const clientResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(clientEmailPayload),
    });

    if (clientResponse.ok) {
      const clientResult = await clientResponse.json();
      emailResults.push({ recipient: clientEmail, success: true, id: clientResult.id });
      await logEmail(supabase, { template_id: clientTemplate?.id, contract_id: contractId, recipient_email: clientEmail, status: "sent" });
    } else {
      const clientError = await clientResponse.json();
      emailResults.push({ recipient: clientEmail, success: false, error: JSON.stringify(clientError) });
      await logEmail(supabase, { template_id: clientTemplate?.id, contract_id: contractId, recipient_email: clientEmail, status: "failed" });
    }

    // Send to SUPPLIER
    if (ccSupplierEmail) {
      const supplierEmailText = supplierTemplate
        ? replacePlaceholders(supplierTemplate.body, placeholderVars)
        : buildSupplierEmailTextFallback(dateFrom, dateTo, destination);
      const supplierSubject = supplierTemplate
        ? replacePlaceholders(supplierTemplate.subject, placeholderVars)
        : subject;

      const supplierEmailPayload: any = {
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [ccSupplierEmail],
        bcc: ["zajezdy@yarotravel.cz"],
        subject: supplierSubject,
        text: supplierEmailText,
      };
      if (pdfAttachment.length > 0) supplierEmailPayload.attachments = pdfAttachment;

      const supplierResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify(supplierEmailPayload),
      });

      if (supplierResponse.ok) {
        const supplierResult = await supplierResponse.json();
        emailResults.push({ recipient: ccSupplierEmail, success: true, id: supplierResult.id });
        await logEmail(supabase, { template_id: supplierTemplate?.id, contract_id: contractId, recipient_email: ccSupplierEmail, status: "sent" });
      } else {
        const supplierError = await supplierResponse.json();
        emailResults.push({ recipient: ccSupplierEmail, success: false, error: JSON.stringify(supplierError) });
      }
    }

    // Update sent_at
    await supabase
      .from("travel_contracts")
      .update({ sent_at: new Date().toISOString(), status: contract.status === 'draft' ? 'sent' : contract.status })
      .eq("id", contractId);

    const allSuccessful = emailResults.every((r) => r.success);

    // Sync to Airtable (fire and forget - don't block the response)
    if (allSuccessful) {
      try {
        const airtableSyncUrl = `${supabaseUrl}/functions/v1/sync-contract-airtable`;
        fetch(airtableSyncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ contractId }),
        }).catch((err) => console.error("Airtable sync failed (non-blocking):", err));
      } catch (e) {
        console.error("Airtable sync trigger failed:", e);
      }
    }

    return new Response(JSON.stringify({
      success: allSuccessful,
      message: allSuccessful ? "Emails sent successfully" : "Some emails failed",
      recipients: emailResults.map((r) => r.recipient),
      results: emailResults,
      hasPdfAttachment: pdfAttachment.length > 0,
    }), {
      status: allSuccessful ? 200 : 207,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending contract email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
