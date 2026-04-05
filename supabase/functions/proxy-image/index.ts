import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, mode } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "image/*,*/*;q=0.8",
      "Referer": new URL(url).origin + "/",
    };

    // HEAD-ONLY mode: return dimensions and size without downloading full image
    if (mode === "head-only") {
      console.log("Head-only probe:", url);
      try {
        // First try HEAD request for Content-Length
        let contentLength: number | null = null;
        let contentType = "image/jpeg";
        try {
          const headResp = await fetch(url, { method: "HEAD", headers });
          if (headResp.ok) {
            const cl = headResp.headers.get("content-length");
            contentLength = cl ? parseInt(cl) : null;
            contentType = headResp.headers.get("content-type") || "image/jpeg";
          }
        } catch { /* HEAD might not be supported */ }

        // Download first 64KB to decode image dimensions
        const rangeHeaders = { ...headers, "Range": "bytes=0-65535" };
        let response: Response;
        try {
          response = await fetch(url, { headers: rangeHeaders });
        } catch {
          return new Response(
            JSON.stringify({ width: null, height: null, size: contentLength, contentType, skipped: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!response.ok && response.status !== 206) {
          return new Response(
            JSON.stringify({ width: null, height: null, size: contentLength, contentType, skipped: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If no content-length from HEAD, try from this response
        if (contentLength === null) {
          const cl = response.headers.get("content-length");
          const cr = response.headers.get("content-range"); // e.g. bytes 0-65535/123456
          if (cr) {
            const totalMatch = cr.match(/\/(\d+)$/);
            if (totalMatch) contentLength = parseInt(totalMatch[1]);
          } else if (cl) {
            contentLength = parseInt(cl);
          }
        }

        contentType = response.headers.get("content-type") || contentType;
        const buf = await response.arrayBuffer();
        const bytes = new Uint8Array(buf);

        let width: number | null = null;
        let height: number | null = null;

        // JPEG: scan for SOF marker
        if (contentType.includes("jpeg") || contentType.includes("jpg")) {
          for (let i = 0; i < bytes.length - 8; i++) {
            if (bytes[i] === 0xFF && (bytes[i + 1] >= 0xC0 && bytes[i + 1] <= 0xCF) && bytes[i + 1] !== 0xC4 && bytes[i + 1] !== 0xC8) {
              height = (bytes[i + 5] << 8) | bytes[i + 6];
              width = (bytes[i + 7] << 8) | bytes[i + 8];
              break;
            }
          }
        }
        // PNG: dimensions at fixed offset
        else if (contentType.includes("png") && bytes.length > 24) {
          if (bytes[0] === 0x89 && bytes[1] === 0x50) {
            width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
            height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
          }
        }
        // WebP
        else if (contentType.includes("webp") && bytes.length > 30) {
          const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
          if (riff === "RIFF") {
            const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
            if (webp === "WEBP") {
              const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
              if (chunk === "VP8 " && bytes.length > 26) {
                width = (bytes[26] | (bytes[27] << 8)) & 0x3FFF;
                height = (bytes[28] | (bytes[29] << 8)) & 0x3FFF;
              } else if (chunk === "VP8L" && bytes.length > 25) {
                const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
                width = ((b0 | (b1 << 8)) & 0x3FFF) + 1;
                height = (((b1 >> 6) | (b2 << 2) | (b3 << 10)) & 0x3FFF) + 1;
              }
            }
          }
        }

        return new Response(
          JSON.stringify({ width, height, size: contentLength, contentType }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Head-only probe error:", err);
        return new Response(
          JSON.stringify({ width: null, height: null, size: null, contentType: null, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // FULL download mode (default)
    console.log("Proxying image:", url);

    let response: Response;
    try {
      response = await fetch(url, { headers });
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
