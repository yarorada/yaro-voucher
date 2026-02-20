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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { dealId, clientEmail, clientName, emailBody, emailSubject }: SendRequest = await req.json();

    if (!dealId || !clientEmail) {
      return new Response(JSON.stringify({ error: "Missing dealId or clientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending deal documents for deal:", dealId, "to:", clientEmail);

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all deal documents
    const { data: documents, error: docsError } = await supabase
      .from("deal_documents")
      .select("*")
      .eq("deal_id", dealId)
      .order("uploaded_at", { ascending: true });

    if (docsError) {
      throw new Error("Failed to fetch deal documents: " + docsError.message);
    }

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents found for this deal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${documents.length} documents to attach`);

    // Download each document and prepare attachments
    const attachments: { filename: string; content: string }[] = [];

    for (const doc of documents) {
      try {
        // Extract storage path from public URL
        const parts = doc.file_url.split("/deal-documents/");
        if (parts.length < 2) {
          // Try fetching directly via URL for external files
          console.log("Fetching external file:", doc.file_name);
          const response = await fetch(doc.file_url);
          if (!response.ok) {
            console.error(`Failed to fetch ${doc.file_name}: ${response.status}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
          attachments.push({ filename: doc.file_name, content: base64 });
          continue;
        }

        const storagePath = decodeURIComponent(parts[1]);
        console.log("Downloading from storage:", storagePath);

        const { data: fileData, error: fileError } = await supabase.storage
          .from("deal-documents")
          .download(storagePath);

        if (fileError || !fileData) {
          console.error(`Error downloading ${doc.file_name}:`, fileError);
          // Fallback: try fetching from public URL
          const response = await fetch(doc.file_url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
            attachments.push({ filename: doc.file_name, content: base64 });
          }
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = arrayBufferToBase64(new Uint8Array(arrayBuffer));
        attachments.push({ filename: doc.file_name, content: base64 });
        console.log(`Prepared attachment: ${doc.file_name} (${arrayBuffer.byteLength} bytes)`);
      } catch (err) {
        console.error(`Error processing ${doc.file_name}:`, err);
      }
    }

    if (attachments.length === 0) {
      return new Response(JSON.stringify({ error: "Could not prepare any attachments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending email with ${attachments.length} attachments`);

    // Check total size - Resend limit is ~40MB
    const totalSize = attachments.reduce((sum, a) => sum + a.content.length, 0);
    console.log(`Total attachment size (base64): ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    const emailPayload: any = {
      from: "YARO Travel <radek@yarogolf.cz>",
      to: [clientEmail],
      bcc: ["zajezdy@yarotravel.cz"],
      subject: emailSubject,
      text: emailBody,
      attachments,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend API error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errorData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: result.id,
        attachmentCount: attachments.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
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

serve(handler);
