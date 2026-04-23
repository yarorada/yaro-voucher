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

    console.log("Processing bulk client data with AI...");

    // Volání AI s tool calling pro strukturovaný výstup
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
            content: "Jsi expert na extrakci strukturovaných dat o klientech z různých formátů textu. Pro každé jméno automaticky určíš titul Pan nebo Paní podle toho, zda je jméno typicky mužské nebo ženské v českém/slovenském jazyce."
          },
          {
            role: "user",
            content: `Extrahuj informace o klientech z následujícího textu. Pro každého klienta najdi: jméno, příjmení, email, telefon, datum narození (ve formátu YYYY-MM-DD), číslo pasu, platnost pasu (ve formátu YYYY-MM-DD), číslo občanského průkazu, platnost OP (ve formátu YYYY-MM-DD) a automaticky přiřaď titul (Pan/Paní).

Telefon poznáš podle některého z těchto vzorů:
- mezinárodní formát začínající "+" (např. "+420 602 123 456", "+421901234567", "+44 20 7946 0958")
- formát začínající "00" jako mezinárodní prefix (např. "00420602123456")
- české/slovenské mobilní/pevné číslo o 9 číslicích (např. "602 123 456", "602123456", "777-888-999")
Při extrakci ignoruj mezery, pomlčky, tečky a závorky uvnitř čísla. Hodnotu vrať tak, jak je v textu uvedena (klient si formát normalizuje sám). Pokud je v textu více čísel u jednoho klienta, vyber to první.

Text:\n\n${text}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_clients",
              description: "Extrahuje strukturované údaje o klientech z textu",
              parameters: {
                type: "object",
                properties: {
                  clients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { 
                          type: "string", 
                          enum: ["Pan", "Paní"],
                          description: "Titul určený podle jména - Pan pro mužská jména, Paní pro ženská jména"
                        },
                        first_name: { type: "string", description: "Křestní jméno" },
                        last_name: { type: "string", description: "Příjmení" },
                        email: { type: "string", description: "Emailová adresa (pokud je uvedena)" },
                        phone: { type: "string", description: "Telefonní číslo. Rozpoznej podle mezinárodního formátu začínajícího + nebo 00, nebo podle formátu 9 číslic (případně se separátory jako mezery/pomlčky/tečky)." },
                        date_of_birth: { type: "string", description: "Datum narození ve formátu YYYY-MM-DD (pokud je uvedeno)" },
                        passport_number: { type: "string", description: "Číslo pasu (pokud je uvedeno)" },
                        passport_expiry: { type: "string", description: "Platnost pasu do ve formátu YYYY-MM-DD (pokud je uvedena)" },
                        id_card_number: { type: "string", description: "Číslo občanského průkazu (pokud je uvedeno)" },
                        id_card_expiry: { type: "string", description: "Platnost občanského průkazu do ve formátu YYYY-MM-DD (pokud je uvedena)" }
                      },
                      required: ["title", "first_name", "last_name"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["clients"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_clients" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Překročen limit požadavků. Zkuste to prosím později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
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
      throw new Error("No tool call in AI response");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    
    console.log(`Successfully parsed ${parsedData.clients.length} clients`);
    
    return new Response(
      JSON.stringify({ success: true, clients: parsedData.clients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error parsing bulk client data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
