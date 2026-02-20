import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function arrayBufferToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Calculate target date = today + 7 days
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    console.log(`[auto-send] Looking for deals with start_date = ${targetDateStr}`);

    // Find deals marked for auto-send
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("id, deal_number, start_date")
      .eq("auto_send_documents", true)
      .is("documents_auto_sent_at", null)
      .eq("start_date", targetDateStr)
      .in("status", ["confirmed", "dispatched"]);

    if (dealsError) throw dealsError;

    if (!deals || deals.length === 0) {
      console.log("[auto-send] No deals to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-send] Found ${deals.length} deals to process`);
    const results: { dealId: string; success: boolean; error?: string }[] = [];

    for (const deal of deals) {
      try {
        // Get lead traveler email
        const { data: travelers } = await supabase
          .from("deal_travelers")
          .select("client_id, is_lead_traveler, clients:client_id(first_name, last_name, email)")
          .eq("deal_id", deal.id)
          .eq("is_lead_traveler", true)
          .limit(1);

        const lead = travelers?.[0] as any;
        const clientEmail = lead?.clients?.email;
        const clientName = lead ? `${lead.clients.first_name} ${lead.clients.last_name}` : "";

        if (!clientEmail) {
          console.log(`[auto-send] Deal ${deal.deal_number}: no lead traveler email, skipping`);
          results.push({ dealId: deal.id, success: false, error: "No client email" });
          continue;
        }

        // Fetch deal documents
        const { data: documents } = await supabase
          .from("deal_documents")
          .select("*")
          .eq("deal_id", deal.id)
          .order("uploaded_at", { ascending: true });

        // Fetch vouchers for this deal
        const { data: vouchers } = await supabase
          .from("vouchers")
          .select("id, voucher_code, sent_at")
          .eq("deal_id", deal.id);

        // Prepare attachments from deal_documents
        const attachments: { filename: string; content: string }[] = [];

        for (const doc of documents || []) {
          try {
            const parts = doc.file_url.split("/deal-documents/");
            if (parts.length >= 2) {
              const storagePath = decodeURIComponent(parts[1]);
              const { data: fileData, error: fileError } = await supabase.storage
                .from("deal-documents")
                .download(storagePath);
              if (!fileError && fileData) {
                const arrayBuffer = await fileData.arrayBuffer();
                const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
                attachments.push({ filename: doc.file_name, content: base64 });
                continue;
              }
            }
            // Fallback: fetch from URL
            const response = await fetch(doc.file_url);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
              attachments.push({ filename: doc.file_name, content: base64 });
            }
          } catch (err) {
            console.error(`[auto-send] Error processing doc ${doc.file_name}:`, err);
          }
        }

        // Add voucher PDFs from voucher-pdfs bucket (for sent vouchers)
        for (const voucher of vouchers || []) {
          if (!voucher.sent_at) continue;
          // Check if already included as a deal document
          const alreadyIncluded = attachments.some(a =>
            a.filename.toLowerCase().includes(voucher.voucher_code.toLowerCase())
          );
          if (alreadyIncluded) continue;

          try {
            // List files in voucher-pdfs bucket for this voucher
            const { data: files } = await supabase.storage
              .from("voucher-pdfs")
              .list("", { search: voucher.voucher_code });

            if (files && files.length > 0) {
              const { data: fileData } = await supabase.storage
                .from("voucher-pdfs")
                .download(files[0].name);
              if (fileData) {
                const arrayBuffer = await fileData.arrayBuffer();
                const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
                attachments.push({
                  filename: `Voucher_${voucher.voucher_code}.pdf`,
                  content: base64,
                });
              }
            }
          } catch (err) {
            console.error(`[auto-send] Error fetching voucher PDF ${voucher.voucher_code}:`, err);
          }
        }

        if (attachments.length === 0) {
          console.log(`[auto-send] Deal ${deal.deal_number}: no documents/vouchers to send`);
          results.push({ dealId: deal.id, success: false, error: "No documents" });
          continue;
        }

        console.log(`[auto-send] Deal ${deal.deal_number}: sending ${attachments.length} attachments to ${clientEmail}`);

        // Send email via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "YARO Travel <radek@yarogolf.cz>",
            to: [clientEmail],
            bcc: ["zajezdy@yarotravel.cz"],
            subject: "Cestovní dokumenty - YARO Travel",
            text: `Vážený ${clientName},\n\nv příloze zasíláme kompletní cestovní dokumenty k Vašemu zájezdu.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`,
            attachments,
          }),
        });

        if (!emailResponse.ok) {
          const errData = await emailResponse.json();
          console.error(`[auto-send] Resend error for ${deal.deal_number}:`, errData);
          results.push({ dealId: deal.id, success: false, error: JSON.stringify(errData) });
          continue;
        }

        // Mark as sent
        await supabase
          .from("deals")
          .update({ documents_auto_sent_at: new Date().toISOString() })
          .eq("id", deal.id);

        console.log(`[auto-send] Deal ${deal.deal_number}: sent successfully`);
        results.push({ dealId: deal.id, success: true });
      } catch (err: any) {
        console.error(`[auto-send] Error processing deal ${deal.deal_number}:`, err);
        results.push({ dealId: deal.id, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[auto-send] Done. ${successCount}/${results.length} sent successfully`);

    return new Response(
      JSON.stringify({ processed: results.length, successful: successCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[auto-send] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
