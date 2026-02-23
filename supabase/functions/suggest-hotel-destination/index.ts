import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName } = await req.json();
    if (!hotelName?.trim()) {
      return new Response(JSON.stringify({ error: "Hotel name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: `You are a golf travel industry expert specializing in golf resorts worldwide. Given a hotel or resort name, determine:
1. The destination/region name (e.g. "Belek", "Hurghada", "Algarve", "Costa del Sol")
2. The country name in Czech (e.g. "Turecko", "Egypt", "Portugalsko", "Španělsko")
3. The ISO 3166-1 alpha-3 country code (e.g. "TUR", "EGY", "PRT", "ESP")
4. A short catchy subtitle in Czech for marketing purposes (e.g. "5* golf resort v srdci Beleku", "Luxusní retreat na břehu Rudého moře"). Keep it under 60 characters. Include star rating if known.
5. Golf courses associated with or near the hotel. If the hotel/resort has its own golf course(s), list them. If not, suggest the 3 nearest golf courses with approximate driving distance in minutes (e.g. "Royal Golf Marrakech (15 min)", "Amelkis Golf Club (20 min)"). Separate multiple courses with comma.

Use the tool to return your answer.`,
          },
          {
            role: "user",
            content: `Hotel name: "${hotelName.trim()}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_destination",
              description: "Return the suggested destination, country, subtitle and golf courses for the hotel",
              parameters: {
                type: "object",
                properties: {
                  destination: {
                    type: "string",
                    description: "Region/area name, e.g. Belek, Hurghada, Algarve",
                  },
                  country: {
                    type: "string",
                    description: "Country name in Czech, e.g. Turecko, Egypt",
                  },
                  iso_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-3 country code, e.g. TUR, EGY",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "How confident you are about this suggestion",
                  },
                  subtitle: {
                    type: "string",
                    description: "Short catchy subtitle in Czech for marketing, under 60 chars",
                  },
                  golf_courses: {
                    type: "string",
                    description: "Comma-separated golf courses. Own courses listed by name, nearby courses with driving time in parentheses",
                  },
                },
                required: ["destination", "country", "iso_code", "confidence", "subtitle", "golf_courses"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_destination" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No suggestion returned");
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-hotel-destination error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
