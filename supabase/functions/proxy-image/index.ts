import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Proxying image:", url);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/*,*/*;q=0.8",
          "Referer": new URL(url).origin + "/",
        },
      });
    } catch (fetchErr) {
      console.warn("Fetch failed for:", url, fetchErr);
      return new Response(
        JSON.stringify({ base64: null, contentType: null, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.warn(`Image returned ${response.status} for: ${url}`);
      return new Response(
        JSON.stringify({ base64: null, contentType: null, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify it's actually an image
    const contentTypeHeader = response.headers.get("content-type") || "";
    if (!contentTypeHeader.includes("image")) {
      console.warn(`Not an image (${contentTypeHeader}) for: ${url}`);
      return new Response(
        JSON.stringify({ base64: null, contentType: null, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = contentTypeHeader || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    // Convert to base64
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

    return new Response(
      JSON.stringify({ base64, contentType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proxy image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to proxy image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
