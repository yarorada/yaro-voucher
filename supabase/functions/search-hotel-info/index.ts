import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName, golfCourseName } = await req.json();

    if (!hotelName) {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Perplexity API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching hotel info via Perplexity:", hotelName, "golf:", golfCourseName);

    // Build prompt focused on golf travelers
    const golfContext = golfCourseName
      ? ` Hotel se nachází v blízkosti golfového hřiště ${golfCourseName}.`
      : "";

    const prompt = `Napiš stručný popis hotelu "${hotelName}" pro golfové cestovatele (2-3 odstavce, max 400 slov).${golfContext} Zaměř se na:
- Polohu hotelu a okolí
- Kvalitu pokojů a vybavení
- Stravování a restaurace
- Wellness/spa a volnočasové aktivity
- Blízkost golfových hřišť a jejich kvalitu
Piš v češtině, profesionálním stylem vhodným pro cestovní agenturu.`;

    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "Jsi odborník na golfové cestování a hotelový průmysl. Piš výhradně v češtině. Odpovídej pouze popisem hotelu, bez úvodních frází typu 'Zde je popis'. Pokud hotel neznáš, napiš to stručně.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!perplexityResponse.ok) {
      const errText = await perplexityResponse.text();
      console.error("Perplexity API error:", perplexityResponse.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Perplexity error: ${perplexityResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    let description = perplexityData.choices?.[0]?.message?.content?.trim() || "";
    const citations = perplexityData.citations || [];

    console.log(`Perplexity returned ${description.length} chars, ${citations.length} citations`);

    // If the response seems to be in English, translate to Czech via Lovable AI
    const czechPattern = /[čďěňřšťůžČĎĚŇŘŠŤŮŽ]/;
    if (description && !czechPattern.test(description)) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          console.log("Translating description to Czech...");
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "Jsi překladatel. Přelož následující popis hotelu do češtiny. Vrať pouze přeložený text, nic jiného. Zachovej význam a styl původního textu.",
                },
                { role: "user", content: description },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const translated = aiData.choices?.[0]?.message?.content?.trim();
            if (translated) {
              description = translated;
              console.log("Description translated to Czech successfully");
            }
          } else {
            console.error("AI translation failed:", aiResponse.status);
          }
        }
      } catch (translateError) {
        console.error("Translation error:", translateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, description, citations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-hotel-info:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
