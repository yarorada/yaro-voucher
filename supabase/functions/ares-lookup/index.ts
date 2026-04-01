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
    const url = `https://ares.gov.cz/ekonomicke-subjekty-v-registru-statistickem-a-telefonnim/rest/ekonomicke-subjekty/${paddedIco}`;

    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Subjekt nenalezen" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();

    const sidlo = data.sidlo || {};
    const addressParts = [
      sidlo.nazevUlice ? `${sidlo.nazevUlice} ${sidlo.cisloDomovni || ""}${sidlo.cisloOrientacni ? "/" + sidlo.cisloOrientacni : ""}`.trim() : null,
      sidlo.nazevObce,
      sidlo.psc ? String(sidlo.psc) : null,
    ].filter(Boolean);

    const result = {
      name: data.obchodniJmeno || "",
      ico: paddedIco,
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
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
