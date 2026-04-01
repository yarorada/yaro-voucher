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

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Build email payload
    const emailPayload: Record<string, unknown> = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [recipientEmail],
      subject,
      html: body.replace(/\n/g, "<br>"),
    };

    // Attach PDF if file_url exists
    if (invoice.file_url) {
      try {
        // Extract bucket and path from the storage URL
        const pdfContent = await fetchPdfFromStorage(supabase, invoice.file_url, supabaseUrl, serviceKey);
        if (pdfContent) {
          const fileName = invoice.file_name || `faktura-${invoice.invoice_number || invoiceId}.pdf`;
          emailPayload.attachments = [{
            filename: fileName,
            content: pdfContent,
          }];
          console.log("PDF attachment added:", fileName);
        }
      } catch (pdfErr) {
        console.error("Failed to fetch PDF for attachment, sending without it:", pdfErr);
      }
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
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

async function fetchPdfFromStorage(
  supabase: any,
  fileUrl: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string | null> {
  // Try to extract bucket/path from Supabase storage URL
  const storagePattern = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/;
  const match = fileUrl.match(storagePattern);

  if (match) {
    const bucket = match[1];
    const path = decodeURIComponent(match[2].split("?")[0]);
    
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.error("Storage download error:", error);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
  }

  // Fallback: fetch directly with service key auth
  const fetchUrl = fileUrl.startsWith("http") ? fileUrl : `${supabaseUrl}${fileUrl}`;
  const response = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  
  if (!response.ok) {
    console.error("Direct fetch failed:", response.status);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

V příloze naleznete PDF faktury.

S pozdravem,
YARO Travel
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;
}
