import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dealId, pdfBase64, pdfPath, supplierEmail, supplierName, hotelName, dealNumber, dateFrom, dateTo, customMessage } = await req.json();

    if (!supplierEmail || (!pdfBase64 && !pdfPath)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PDF attachment - either from inline base64 or from storage (legacy)
    let pdfAttachment: any[] = [];
    if (pdfBase64) {
      pdfAttachment = [{ filename: `rooming-list-${dealNumber || "deal"}.pdf`, content: pdfBase64 }];
    } else if (pdfPath) {
      const { data: pdfData, error: pdfError } = await supabaseAdmin.storage.from("voucher-pdfs").download(pdfPath);
      if (!pdfError && pdfData) {
        const arrayBuffer = await pdfData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
        }
        pdfAttachment = [{ filename: `rooming-list-${dealNumber || "deal"}.pdf`, content: btoa(binary) }];
      }
      // Cleanup uploaded PDF
      await supabaseAdmin.storage.from("voucher-pdfs").remove([pdfPath]);
    }

    const dateFromFormatted = dateFrom ? formatDate(dateFrom) : "";
    const dateToFormatted = dateTo ? formatDate(dateTo) : "";
    const dateRange = dateFromFormatted && dateToFormatted ? `${dateFromFormatted} - ${dateToFormatted}` : "";

    const subject = `Rooming List${hotelName ? ` - ${hotelName}` : ""}${dateRange ? ` (${dateRange})` : ""} - YARO Travel`;

    const emailText = customMessage || `Dear ${supplierName || "partner"},

Please find attached the rooming list for ${hotelName || "the hotel"}${dateRange ? ` for the period ${dateRange}` : ""}.

If you have any questions, please do not hesitate to contact us.

Best regards,
YARO Travel
Tel.: +420 602 102 108
zajezdy@yarotravel.cz`;

    const emailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [supplierEmail],
      bcc: ["zajezdy@yarotravel.cz"],
      subject,
      text: emailText,
    };
    if (pdfAttachment.length > 0) emailPayload.attachments = pdfAttachment;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      const result = await response.json();
      try {
        await supabaseAdmin.from("email_log").insert({
          deal_id: dealId,
          recipient_email: supplierEmail,
          status: "sent",
        });
      } catch (e) {
        console.error("Failed to log email:", e);
      }

      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorData = await response.json();
      console.error("Resend error:", errorData);
      return new Response(JSON.stringify({ success: false, error: JSON.stringify(errorData) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
