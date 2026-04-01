import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ico } = await req.json();
    if (!ico || !/^\d{2,8}$/.test(ico.trim())) {
      return new Response(JSON.stringify({ error: "Neplatné IČO" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paddedIco = ico.trim().padStart(8, "0");

    // Try the new ARES REST API first
    const url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${paddedIco}`;

    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      // Fallback: try the XML-based API via JSON endpoint
      const fallbackUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat?ico=${paddedIco}`;
      const fallbackResp = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
      });

      if (!fallbackResp.ok) {
        const body = await fallbackResp.text();
        console.error("ARES fallback error:", fallbackResp.status, body);
        return new Response(JSON.stringify({ error: "Subjekt nenalezen" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fallbackData = await fallbackResp.json();
      // The search endpoint returns an array
      const subject = fallbackData?.ekonomickeSubjekty?.[0] || fallbackData;
      return buildResponse(subject, paddedIco);
    }

    const data = await resp.json();
    return buildResponse(data, paddedIco);
  } catch (e) {
    console.error("ARES lookup error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildResponse(data: any, paddedIco: string) {
  const sidlo = data.sidlo || {};
  const addressParts = [
    sidlo.nazevUlice
      ? `${sidlo.nazevUlice} ${sidlo.cisloDomovni || ""}${sidlo.cisloOrientacni ? "/" + sidlo.cisloOrientacni : ""}`.trim()
      : sidlo.textovaAdresa || null,
    sidlo.nazevObce,
    sidlo.psc ? String(sidlo.psc) : null,
  ].filter(Boolean);

  const result = {
    name: data.obchodniJmeno || data.nazev || "",
    ico: data.ico || paddedIco,
    dic: data.dic || "",
    address: addressParts.join(", "),
    city: sidlo.nazevObce || "",
    postal_code: sidlo.psc ? String(sidlo.psc) : "",
    street: sidlo.nazevUlice
      ? `${sidlo.nazevUlice} ${sidlo.cisloDomovni || ""}${sidlo.cisloOrientacni ? "/" + sidlo.cisloOrientacni : ""}`.trim()
      : sidlo.textovaAdresa || "",
  };

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
