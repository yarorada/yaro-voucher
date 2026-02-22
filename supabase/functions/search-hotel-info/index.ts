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

    // Build prompt focused on golf travelers with 5-paragraph template
    const golfContext = golfCourseName
      ? ` Hotel se nachází v blízkosti golfového hřiště ${golfCourseName}.`
      : "";

    const prompt = `Napiš popis hotelu "${hotelName}" pro golfové cestovatele.${golfContext}
Popis musí mít přesně 5 odstavců oddělených prázdným řádkem.
Každý odstavec MUSÍ začínat tučným názvem sekce (použij HTML tag <strong>) následovaným textem.

1. odstavec: Začni "<strong>Úvodní odstavec</strong>" - pak základní představení hotelu, název, počet hvězdiček, rozloha areálu, poloha, hlavní přednost.

2. odstavec: Začni "<strong>Pokoje a stravování</strong>" - pak počet pokojů, typ pokojů, vybavení, koncept stravování, počet restaurací.

3. odstavec: Začni "<strong>Golf</strong>" - pak název golfového hřiště, designer, počet jamek, par, driving range, putting green, golf academy.

4. odstavec: Začni "<strong>Wellness a volný čas</strong>" - pak bazény, wellness/spa, hammam, sauna, fitness, pláž a její vzdálenost.

5. odstavec: Začni "<strong>Závěrečné doporučení</strong>" - pak proč je hotel ideální pro golfisty, dostupnost dalších hřišť v okolí.

Nepoužívej žádné nadpisy, odrážky ani markdown formátování (žádné #, *, -, **).
Piš pouze plynulý text v odstavcích. Piš v češtině, profesionálním stylem vhodným pro cestovní agenturu.`;

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
            content: "Jsi odborník na golfové cestování a hotelový průmysl. Piš výhradně v češtině. Odpovídej pouze popisem hotelu ve formě 5 plynulých odstavců oddělených prázdným řádkem. Nepoužívej žádné nadpisy, odrážky, číslování ani markdown formátování. Žádné úvodní fráze typu 'Zde je popis'. Pokud hotel neznáš, napiš to stručně.",
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
    // Strip citation numbers like [1], [2][3], etc.
    description = description.replace(/\[\d+\]/g, "").trim();
    // Strip markdown bold markers **text** → text
    description = description.replace(/\*\*(.*?)\*\*/g, "$1");
    // Convert paragraphs (double newline separated) to HTML <p> tags
    const paragraphs = description.split(/\n\s*\n/).map(p => p.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim()).filter(p => p.length > 0);
    description = paragraphs.map(p => `<p>${p}</p>`).join("\n");

    console.log(`Perplexity returned ${description.length} chars`);

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

    // Search for image URLs via Perplexity
    let imageUrls: string[] = [];
    try {
      const imagePrompt = `Find high-quality photo URLs of hotel "${hotelName}". Return ONLY a list of direct image URLs (jpg, jpeg, png, webp) from the hotel's official website or reputable travel sites. No text, just URLs, one per line.`;
      
      const imageResponse = await fetch("https://api.perplexity.ai/chat/completions", {
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
              content: "You are a hotel image finder. Return ONLY direct image URLs, one per line. No markdown, no text, no explanations. Only URLs ending in .jpg, .jpeg, .png, or .webp.",
            },
            { role: "user", content: imagePrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const imageContent = imageData.choices?.[0]?.message?.content || "";
        // Extract URLs from the response
        const urlRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi;
        const matches = imageContent.match(urlRegex) || [];
        imageUrls = [...new Set(matches)].slice(0, 12);
        console.log(`Perplexity found ${imageUrls.length} image URLs`);
      }
    } catch (imgError) {
      console.error("Image search error:", imgError);
    }

    return new Response(
      JSON.stringify({ success: true, description, imageUrls }),
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
