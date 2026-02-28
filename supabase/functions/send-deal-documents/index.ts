import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  dealId: string;
  clientEmail: string;
  clientName: string;
  emailBody: string;
  emailSubject: string;
  ccEmails?: string[];
  documentIds?: string[];
  inlineAttachments?: { filename: string; base64: string }[];
}

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

async function logEmail(supabase: any, params: { template_id?: string; deal_id?: string; recipient_email: string; status: string }) {
  try { await supabase.from("email_log").insert(params); } catch (e) { console.error("Failed to log email:", e); }
}

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

    const { dealId, clientEmail, clientName, emailBody, emailSubject, ccEmails, documentIds, inlineAttachments }: SendRequest = await req.json();

    if (!dealId || !clientEmail) {
      return new Response(JSON.stringify({ error: "Missing dealId or clientEmail" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending deal documents for deal:", dealId, "to:", clientEmail);

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no custom emailBody/emailSubject provided, try loading template
    let finalSubject = emailSubject;
    let finalBody = emailBody;
    let templateId: string | undefined;

    if (!emailBody || !emailSubject) {
      const template = await getTemplate(supabase, "deal_docs_client_cz");
      if (template) {
        templateId = template.id;
        const nameParts = (clientName || "").split(" ");
        const vars: Record<string, string> = {
          first_name: nameParts[0] || "",
          last_name: nameParts.slice(1).join(" ") || clientName || "",
          destination: "",
          hotel: "",
          date_from: "",
          date_to: "",
          total_price: "",
          voucher_code: "",
          contract_number: "",
          sign_link: "",
        };
        if (!finalSubject) finalSubject = replacePlaceholders(template.subject, vars);
        if (!finalBody) finalBody = replacePlaceholders(template.body, vars);
      }
    }

    // Prepare attachments
    const attachments: { filename: string; content: string }[] = [];

    // Add inline attachments (e.g. voucher PDFs generated client-side)
    for (const inline of (inlineAttachments || [])) {
      attachments.push({ filename: inline.filename, content: inline.base64 });
    }

    // Fetch only requested documents (if documentIds specified and non-empty)
    if (documentIds && documentIds.length > 0) {
      const { data: documents, error: docsError } = await supabase
        .from("deal_documents").select("*")
        .in("id", documentIds);

      if (docsError) throw new Error("Failed to fetch deal documents: " + docsError.message);

      // Download each document in parallel
      await Promise.all((documents || []).map(async (doc) => {
        try {
          const parts = doc.file_url.split("/deal-documents/");
          const storagePath = parts.length >= 2 ? decodeURIComponent(parts[1]) : null;
          if (storagePath) {
            const { data: fileData, error: fileError } = await supabase.storage.from("deal-documents").download(storagePath);
            if (!fileError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              attachments.push({ filename: doc.file_name, content: arrayBufferToBase64(new Uint8Array(arrayBuffer)) });
              return;
            }
          }
          // Fallback: direct fetch
          const response = await fetch(doc.file_url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            attachments.push({ filename: doc.file_name, content: arrayBufferToBase64(new Uint8Array(arrayBuffer)) });
          }
        } catch (err) {
          console.error(`Error processing ${doc.file_name}:`, err);
        }
      }));
    }

    if (attachments.length === 0) {
      return new Response(JSON.stringify({ error: "No attachments could be prepared" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bccList = ["zajezdy@yarotravel.cz"];
    const ccList = (ccEmails || []).filter((e) => e && e !== clientEmail);

    const emailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      bcc: bccList,
      subject: finalSubject,
      text: finalBody,
      attachments,
    };

    if (ccList.length > 0) {
      emailPayload.cc = ccList;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      await logEmail(supabase, { template_id: templateId, deal_id: dealId, recipient_email: clientEmail, status: "failed" });
      return new Response(JSON.stringify({ error: "Failed to send email", details: errorData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    await logEmail(supabase, { template_id: templateId, deal_id: dealId, recipient_email: clientEmail, status: "sent" });

    return new Response(JSON.stringify({
      success: true, emailId: result.id, attachmentCount: attachments.length,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
