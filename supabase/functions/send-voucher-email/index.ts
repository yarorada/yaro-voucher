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
}

// Czech email text for client
const buildClientEmailText = (lastName: string, dateFrom: string, dateTo: string, hotel: string) => {
  return `Vážený ${lastName},

posíláme vám voucher na služby k vašemu zájezdu od ${dateFrom} do ${dateTo} do hotelu ${hotel}.

S pozdravem,
YARO Travel
Tel.: +420 602 102 108
Email: zajezdy@yarotravel.cz`;
};

// English email text for supplier
const buildSupplierEmailText = (dateFrom: string, dateTo: string, hotel: string) => {
  return `Dear valued partner,

we are sending to you voucher for our clients for their stay from ${dateFrom} to ${dateTo} at ${hotel}.

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

// Get travel date range from services
const getTravelDateRange = (services: any[]) => {
  let earliestFrom: string | null = null;
  let latestTo: string | null = null;

  for (const service of services) {
    if (service.dateFrom) {
      if (!earliestFrom || service.dateFrom < earliestFrom) {
        earliestFrom = service.dateFrom;
      }
    }
    if (service.dateTo) {
      if (!latestTo || service.dateTo > latestTo) {
        latestTo = service.dateTo;
      }
    }
  }

  return {
    dateFrom: earliestFrom ? formatDate(earliestFrom) : "N/A",
    dateTo: latestTo ? formatDate(latestTo) : "N/A",
  };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT and get user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voucherId, pdfPath, emailSubjectTemplate, emailCcSupplier }: SendEmailRequest = await req.json();

    // Validate voucherId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!voucherId || !uuidRegex.test(voucherId)) {
      return new Response(JSON.stringify({ error: "Invalid voucher ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending email for voucher:", voucherId, "by user:", user.id, "with PDF:", !!pdfPath);

    // Use SERVICE_ROLE_KEY for fetching data (RLS bypassed for internal operations)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch voucher (service role - no RLS restriction)
    const { data: voucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("id", voucherId)
      .single();

    if (voucherError || !voucher) {
      console.error("Voucher access error:", voucherError);
      return new Response(JSON.stringify({ error: "Voucher not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch travelers
    const { data: travelers, error: travelersError } = await supabase
      .from("voucher_travelers")
      .select("client_id, is_main_client, clients(first_name, last_name, email)")
      .eq("voucher_id", voucherId)
      .order("is_main_client", { ascending: false });

    if (travelersError) {
      throw new Error("Failed to fetch travelers");
    }

    // Fetch supplier
    let supplier = null;
    if (voucher.supplier_id) {
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("name, contact_person, email, phone, address, notes")
        .eq("id", voucher.supplier_id)
        .single();
      supplier = supplierData;
    }

    // Find main client email and name
    const mainClient = travelers?.find((t: any) => t.is_main_client);
    const mainClientData = mainClient?.clients as any;
    const clientEmail = mainClientData?.email;
    const clientLastName = mainClientData?.last_name || "klient";

    if (!clientEmail) {
      throw new Error("Client email not found");
    }

    // Get travel dates and hotel
    const { dateFrom, dateTo } = getTravelDateRange(voucher.services || []);
    const hotelName = voucher.hotel_name || "N/A";

    // Build email subject from template
    const defaultSubjectTemplate = "Travel Voucher {{voucher_code}} - YARO Travel";
    const subjectTemplate = emailSubjectTemplate || defaultSubjectTemplate;
    const subject = subjectTemplate.replace(/\{\{voucher_code\}\}/g, voucher.voucher_code);

    // Prepare PDF attachment if provided
    let pdfAttachment: any[] = [];
    if (pdfPath) {
      console.log("Downloading PDF from storage:", pdfPath);

      const { data: pdfData, error: pdfError } = await supabase.storage.from("voucher-pdfs").download(pdfPath);

      if (pdfError) {
        console.error("Error downloading PDF:", pdfError);
      } else if (pdfData) {
        // Convert blob to base64 in chunks to avoid stack overflow
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

        pdfAttachment = [
          {
            filename: `voucher-${voucher.voucher_code}.pdf`,
            content: base64,
          },
        ];

        console.log("PDF attachment prepared, size:", arrayBuffer.byteLength, "bytes");
      }

      // Clean up the temporary PDF file after preparing attachment
      const { error: deleteError } = await supabase.storage.from("voucher-pdfs").remove([pdfPath]);

      if (deleteError) {
        console.error("Error deleting temporary PDF:", deleteError);
      } else {
        console.log("Temporary PDF cleaned up:", pdfPath);
      }
    }

    const emailResults: { recipient: string; success: boolean; id?: string; error?: string }[] = [];

    // Send email to CLIENT (Czech)
    const clientEmailText = buildClientEmailText(clientLastName, dateFrom, dateTo, hotelName);
    console.log("Sending email to client:", clientEmail);

    const clientEmailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      subject: subject,
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
      console.log("Client email sent successfully:", clientResult);
      emailResults.push({ recipient: clientEmail, success: true, id: clientResult.id });
    } else {
      const clientError = await clientResponse.json();
      console.error("Client email error:", clientError);
      emailResults.push({ recipient: clientEmail, success: false, error: JSON.stringify(clientError) });
    }

    // Send email to SUPPLIER (English) if enabled
    const shouldCcSupplier = emailCcSupplier !== false;
    if (shouldCcSupplier && supplier?.email) {
      const supplierEmailText = buildSupplierEmailText(dateFrom, dateTo, hotelName);
      console.log("Sending email to supplier:", supplier.email);

      const supplierEmailPayload: any = {
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [supplier.email],
        subject: subject,
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
        console.log("Supplier email sent successfully:", supplierResult);
        emailResults.push({ recipient: supplier.email, success: true, id: supplierResult.id });
      } else {
        const supplierError = await supplierResponse.json();
        console.error("Supplier email error:", supplierError);
        emailResults.push({ recipient: supplier.email, success: false, error: JSON.stringify(supplierError) });
      }
    }

    const allSuccessful = emailResults.every((r) => r.success);
    const recipients = emailResults.map((r) => r.recipient);

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        message: allSuccessful ? "Emails sent successfully" : "Some emails failed",
        recipients: recipients,
        results: emailResults,
        hasPdfAttachment: pdfAttachment.length > 0,
      }),
      {
        status: allSuccessful ? 200 : 207,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
