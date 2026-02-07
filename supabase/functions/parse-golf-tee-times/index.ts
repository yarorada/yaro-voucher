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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing golf tee times data with AI...");

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
            content:
              "Jsi expert na extrakci strukturovaných dat o golfových tee times z různých formátů textu (emaily, tabulky, seznamy). Extrahuj všechny tee times včetně data, názvu golfového klubu, času a počtu golfistů. Pokud text obsahuje informace o ceně za osobu nebo celkové ceně, extrahuj je také.",
          },
          {
            role: "user",
            content: `Extrahuj všechny golfové tee times z následujícího textu. Pro každý tee time najdi: datum (ve formátu YYYY-MM-DD), název golfového klubu, čas startu, počet golfistů a případně cenu za osobu:\n\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_tee_times",
              description: "Extrahuje strukturované údaje o tee times z textu",
              parameters: {
                type: "object",
                properties: {
                  tee_times: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: {
                          type: "string",
                          description: "Datum ve formátu YYYY-MM-DD",
                        },
                        club: {
                          type: "string",
                          description: "Název golfového klubu",
                        },
                        time: {
                          type: "string",
                          description: "Čas startu (např. 09:30)",
                        },
                        golfers: {
                          type: "string",
                          description: "Počet golfistů (např. '4 golfers' nebo '2')",
                        },
                        price_per_person: {
                          type: "number",
                          description: "Cena za osobu (pokud je uvedena)",
                        },
                        currency: {
                          type: "string",
                          description: "Měna ceny (EUR, CZK, USD atd.)",
                        },
                      },
                      required: ["club"],
                      additionalProperties: false,
                    },
                  },
                  supplier_name: {
                    type: "string",
                    description: "Název dodavatele/agentury pokud je zmíněn v textu",
                  },
                },
                required: ["tee_times"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_tee_times" } },
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

    if (!toolCall) {
      console.error("No tool call in AI response");
      throw new Error("AI nevrátila platná data");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);

    console.log(`Successfully parsed ${parsedData.tee_times.length} tee times`);

    return new Response(
      JSON.stringify({ success: true, tee_times: parsedData.tee_times, supplier_name: parsedData.supplier_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing golf tee times:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
