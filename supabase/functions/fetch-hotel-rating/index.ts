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

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a data extraction assistant. Given a hotel name, search for its current ratings on Booking.com, TripAdvisor, and Google Reviews. 
Return ONLY a JSON object with this exact structure, no other text:
{
  "booking": <number or null>,
  "tripadvisor": <number or null>,
  "google": <number or null>,
  "average": <number or null>,
  "note": "<brief source info in Czech>"
}
Important rules:
- booking.com ratings are 1-10 scale — return as-is
- tripadvisor ratings are 1-5 scale — multiply by 2 to normalize to 1-10
- google ratings are 1-5 scale — multiply by 2 to normalize to 1-10  
- "average" should be the mean of all available (non-null) normalized values, rounded to 1 decimal
- If no rating found for a platform, use null
- "note" should say which sources were found, e.g. "Booking.com: 8.7, TripAdvisor: 9.0 (z 4.5), Google: 8.6 (z 4.3)"`,
          },
          {
            role: "user",
            content: `Find current ratings for hotel: ${hotelName}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Perplexity error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching hotel rating:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
