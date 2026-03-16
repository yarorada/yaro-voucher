import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log("Processing bulk supplier data with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Jsi expert na extrakci strukturovaných dat o dodavatelích/firmách z různých formátů textu.
Extrahuj co nejvíce informací o každém dodavateli.
Adresu vždy rozděl na: ulice+č.p. (street), PSČ (postal_code), město (city), stát (country_name).
Pokud stát není uveden a PSČ odpovídá ČR (5 číslic nebo formát NNN NN), doplň country_name = "Česká republika".
Pokud stát není uveden a PSČ odpovídá SK, doplň country_name = "Slovensko".
Telefon uložit v mezinárodním formátu, pokud je to možné.
Pokud v textu nalezneš webovou adresu (URL), ulož ji do pole website.`
          },
          {
            role: "user",
            content: `Extrahuj informace o dodavatelích z následujícího textu. Pro každého dodavatele najdi: název, kontaktní osobu, email, telefon, adresu (rozdělenou na části), web a případné poznámky:\n\n${text}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_suppliers",
              description: "Extrahuje strukturované údaje o dodavatelích z textu",
              parameters: {
                type: "object",
                properties: {
                  suppliers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Název firmy nebo dodavatele" },
                        contact_person: { type: "string", description: "Jméno kontaktní osoby" },
                        email: { type: "string", description: "Emailová adresa" },
                        phone: { type: "string", description: "Telefonní číslo v mezinárodním formátu" },
                        street: { type: "string", description: "Ulice a číslo popisné/orientační" },
                        postal_code: { type: "string", description: "PSČ" },
                        city: { type: "string", description: "Město" },
                        country_name: { type: "string", description: "Stát (např. Česká republika, Slovensko, Španělsko)" },
                        website: { type: "string", description: "Webová adresa (URL)" },
                        notes: { type: "string", description: "Další poznámky nebo informace o dodavateli" }
                      },
                      required: ["name"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suppliers"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_suppliers" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Překročen limit požadavků. Zkuste to prosím později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů. Přidejte prosím kredity do vašeho účtu." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error(`AI gateway error: ${response.status}`, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log(`Successfully parsed ${parsedData.suppliers.length} suppliers`);

    return new Response(
      JSON.stringify({ success: true, suppliers: parsedData.suppliers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error parsing bulk supplier data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
