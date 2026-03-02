import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  voucherId: string;
  pdfPath?: string | null;
  emailSubjectTemplate?: string;
  emailCcSupplier?: boolean;
  skipClient?: boolean;
  customEmailSubject?: string;
  customEmailBody?: string;
  extraEmails?: string[];
}

// Fallback Czech email text for client
const buildClientEmailTextFallback = (lastName: string, dateFrom: string, dateTo: string, hotel: string) => {
  return `Vážený ${lastName},\n\nposíláme vám voucher na služby k vašemu zájezdu od ${dateFrom} do ${dateTo} do hotelu ${hotel}.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`;
};

// Fallback English email text for supplier
const buildSupplierEmailTextFallback = (dateFrom: string, dateTo: string, hotel: string) => {
  return `Dear valued partner,\n\nwe are sending to you voucher for our clients for their stay from ${dateFrom} to ${dateTo} at ${hotel}.\n\nPlease find the voucher attached.\n\nBest regards,\nYARO Travel\nTel.: +420 602 102 108\nzajezdy@yarotravel.cz`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

const getTravelDateRange = (services: any[]) => {
  let earliestFrom: string | null = null;
  let latestTo: string | null = null;
  for (const service of services) {
    if (service.dateFrom) {
      if (!earliestFrom || service.dateFrom < earliestFrom) earliestFrom = service.dateFrom;
    }
    if (service.dateTo) {
      if (!latestTo || service.dateTo > latestTo) latestTo = service.dateTo;
    }
  }
  return {
    dateFrom: earliestFrom ? formatDate(earliestFrom) : "N/A",
    dateTo: latestTo ? formatDate(latestTo) : "N/A",
  };
};

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(val);
  }
  return result;
}

async function getTemplate(supabase: any, key: string) {
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("template_key", key)
    .eq("is_active", true)
    .single();
  return data;
}

async function logEmail(supabase: any, params: { template_id?: string; voucher_id?: string; deal_id?: string; contract_id?: string; recipient_email: string; status: string }) {
  try {
    await supabase.from("email_log").insert(params);
  } catch (e) {
    console.error("Failed to log email:", e);
  }
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

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voucherId, pdfPath, emailSubjectTemplate, emailCcSupplier, skipClient, customEmailSubject, customEmailBody, extraEmails }: SendEmailRequest = await req.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!voucherId || !uuidRegex.test(voucherId)) {
      return new Response(JSON.stringify({ error: "Invalid voucher ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending email for voucher:", voucherId, "by user:", user.id);

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: voucher, error: voucherError } = await supabase
      .from("vouchers").select("*").eq("id", voucherId).single();
    if (voucherError || !voucher) {
      return new Response(JSON.stringify({ error: "Voucher not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: travelers } = await supabase
      .from("voucher_travelers")
      .select("client_id, is_main_client, clients(first_name, last_name, email)")
      .eq("voucher_id", voucherId)
      .order("is_main_client", { ascending: false });

    let supplier = null;
    if (voucher.supplier_id) {
      const { data: supplierData } = await supabase
        .from("suppliers").select("name, contact_person, email, phone, address, notes")
        .eq("id", voucher.supplier_id).single();
      supplier = supplierData;
    }

    // Get orderer (lead_client_id) from the deal — that's who gets the email
    let clientEmail: string | null = null;
    let clientLastName = "klient";
    let clientFirstName = "";

    if (voucher.deal_id) {
      const { data: deal } = await supabase
        .from("deals").select("lead_client_id").eq("id", voucher.deal_id).single();
      if (deal?.lead_client_id) {
        const { data: orderer } = await supabase
          .from("clients").select("email, first_name, last_name").eq("id", deal.lead_client_id).single();
        if (orderer) {
          clientEmail = orderer.email;
          clientLastName = orderer.last_name || "klient";
          clientFirstName = orderer.first_name || "";
        }
      }
    }

    // Fallback: main traveler on voucher
    if (!clientEmail) {
      const mainClient = travelers?.find((t: any) => t.is_main_client);
      const mainClientData = mainClient?.clients as any;
      if (mainClientData?.email) {
        clientEmail = mainClientData.email;
        clientLastName = mainClientData.last_name || "klient";
        clientFirstName = mainClientData.first_name || "";
      }
    }

    // Fallback: voucher.client_id
    if (!clientEmail && voucher.client_id) {
      const { data: fallbackClient } = await supabase
        .from("clients").select("email, first_name, last_name").eq("id", voucher.client_id).single();
      if (fallbackClient) {
        clientEmail = fallbackClient.email;
        clientLastName = fallbackClient.last_name || "klient";
        clientFirstName = fallbackClient.first_name || "";
      }
    }

    // If client email not found, skip sending to client (don't throw)
    const noClientEmail = !clientEmail;

    const { dateFrom, dateTo } = getTravelDateRange(voucher.services || []);
    const hotelName = voucher.hotel_name || "N/A";

    const placeholderVars: Record<string, string> = {
      first_name: clientFirstName,
      last_name: clientLastName,
      hotel: hotelName,
      date_from: dateFrom,
      date_to: dateTo,
      voucher_code: voucher.voucher_code,
      total_price: "",
      destination: "",
      contract_number: "",
      sign_link: "",
    };

    // Load templates from DB
    const clientTemplate = await getTemplate(supabase, "voucher_client_cz");
    const supplierTemplate = await getTemplate(supabase, "voucher_supplier_en");

    const defaultSubjectTemplate = "Travel Voucher {{voucher_code}} - YARO Travel";
    const subjectTemplate = customEmailSubject || clientTemplate?.subject || emailSubjectTemplate || defaultSubjectTemplate;
    const subject = replacePlaceholders(subjectTemplate, placeholderVars);

    // Prepare PDF attachment
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
        pdfAttachment = [{ filename: `voucher-${voucher.voucher_code}.pdf`, content: btoa(binary) }];
      }
      await supabase.storage.from("voucher-pdfs").remove([pdfPath]);
    }

    const emailResults: { recipient: string; success: boolean; id?: string; error?: string }[] = [];

    // Send to CLIENT (unless skipClient is true or no client email)
    if (!skipClient && !noClientEmail) {
      const clientEmailText = customEmailBody || (clientTemplate
        ? replacePlaceholders(clientTemplate.body, placeholderVars)
        : buildClientEmailTextFallback(clientLastName, dateFrom, dateTo, hotelName));

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
        await logEmail(supabase, { template_id: clientTemplate?.id, voucher_id: voucherId, recipient_email: clientEmail, status: "sent" });
      } else {
        const clientError = await clientResponse.json();
        emailResults.push({ recipient: clientEmail, success: false, error: JSON.stringify(clientError) });
        await logEmail(supabase, { template_id: clientTemplate?.id, voucher_id: voucherId, recipient_email: clientEmail, status: "failed" });
      }
    }

    // Send to SUPPLIER
    const shouldCcSupplier = emailCcSupplier !== false;
    if (shouldCcSupplier && supplier?.email) {
      const supplierEmailText = customEmailBody || (supplierTemplate
        ? replacePlaceholders(supplierTemplate.body, placeholderVars)
        : buildSupplierEmailTextFallback(dateFrom, dateTo, hotelName));
      const supplierSubject = customEmailSubject || (supplierTemplate
        ? replacePlaceholders(supplierTemplate.subject, placeholderVars)
        : subject);

      const supplierEmailPayload: any = {
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [supplier.email],
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
        emailResults.push({ recipient: supplier.email, success: true, id: supplierResult.id });
        await logEmail(supabase, { template_id: supplierTemplate?.id, voucher_id: voucherId, recipient_email: supplier.email, status: "sent" });
      } else {
        const supplierError = await supplierResponse.json();
        emailResults.push({ recipient: supplier.email, success: false, error: JSON.stringify(supplierError) });
        await logEmail(supabase, { template_id: supplierTemplate?.id, voucher_id: voucherId, recipient_email: supplier.email, status: "failed" });
      }
    }

    // Send to extra emails
    for (const extraEmail of (extraEmails || []).filter(Boolean)) {
      const extraPayload: any = {
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [extraEmail],
        subject: customEmailSubject || subject,
        text: customEmailBody || buildClientEmailTextFallback(clientLastName, dateFrom, dateTo, hotelName),
      };
      if (pdfAttachment.length > 0) extraPayload.attachments = pdfAttachment;
      const extraResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify(extraPayload),
      });
      if (extraResponse.ok) {
        const extraResult = await extraResponse.json();
        emailResults.push({ recipient: extraEmail, success: true, id: extraResult.id });
        await logEmail(supabase, { voucher_id: voucherId, recipient_email: extraEmail, status: "sent" });
      } else {
        emailResults.push({ recipient: extraEmail, success: false });
      }
    }

    const allSuccessful = emailResults.every((r) => r.success);

    // Deal dispatch logic
    if (allSuccessful && voucher.deal_id) {
      try {
        await supabase.from('vouchers').update({ sent_at: new Date().toISOString() }).eq('id', voucherId).is('sent_at', null);
        const { data: unsentVouchers } = await supabase
          .from('vouchers').select('id').eq('deal_id', voucher.deal_id).is('sent_at', null).neq('id', voucherId);
        if (!unsentVouchers || unsentVouchers.length === 0) {
          const { data: deal } = await supabase.from('deals').select('status').eq('id', voucher.deal_id).single();
          if (deal && deal.status !== 'completed' && deal.status !== 'cancelled') {
            await supabase.from('deals').update({ status: 'dispatched' }).eq('id', voucher.deal_id);
          }
        }
      } catch (e) {
        console.error('Error checking deal dispatch status:', e);
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
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
