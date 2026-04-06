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
5. Golf courses: ALWAYS list ALL of the hotel's own courses AND enough nearby courses so that the TOTAL is at least 5 courses. For example, if the hotel has 3 own courses, add at least 2 nearby courses. If the hotel has no own courses, list the 5 nearest. For each course provide:
   - "name": course name
   - "holes": number of holes (number, e.g. 18 or 9). If unknown, use 18 as default.
   - "par": par value (number, e.g. 72). If unknown, use null.
   - "length": course length as string ALWAYS in meters (e.g. "6321 m"). If the source data is in yards, convert to meters (1 yard = 0.9144 m) and round to whole number. If unknown, use null.
   - "architect": course architect/designer name. If unknown, use null.
   - "is_hotel_course": boolean, true if the course belongs to the hotel/resort
   - "distance_km": distance from hotel in km (number, e.g. 5). Only for nearby courses (is_hotel_course=false). Use null for hotel's own courses.
   - "rating": average rating on a 0-10 scale, calculated as the average of known ratings from tripadvisor.com, leadingcourses.com, 1golf.eu and top100golfcourses.com. Normalize all ratings to a 0-10 scale before averaging. If no rating data is available, use null. Round to one decimal place.
6. Exactly 6 compelling reasons (highlights) why a golf traveler should choose this hotel. Each highlight has:
   - "icon": one of these icon names: MapPin, Target, Star, UtensilsCrossed, Users, Calendar, Waves, Sun, Mountain, Trophy, Heart, Gem, Shield, Compass, Palmtree, Building
   - "title": short catchy title in Czech (max 4 words)
   - "text": descriptive text in Czech (1-2 sentences, max 120 chars)
   Focus on: location, golf access, cuisine, atmosphere, wellness, lifestyle/experiences.

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
              description: "Return the suggested destination, country, subtitle, golf courses and highlights for the hotel",
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
                    description: "Comma-separated golf course names for backward compatibility",
                  },
                  golf_courses_data: {
                    type: "array",
                    description: "Structured golf course data",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Course name" },
                        par: { type: ["number", "null"], description: "Par value, e.g. 72" },
                        length: { type: ["string", "null"], description: "Course length, e.g. '6321 m'" },
                        architect: { type: ["string", "null"], description: "Course architect/designer" },
                        is_hotel_course: { type: "boolean", description: "True if course belongs to hotel" },
                        distance_km: { type: ["number", "null"], description: "Distance from hotel in km (only for nearby courses)" },
                        rating: { type: ["number", "null"], description: "Average rating 0-10 from tripadvisor, leadingcourses, 1golf.eu, top100golfcourses. Rounded to 1 decimal." },
                      },
                      required: ["name", "is_hotel_course"],
                    },
                  },
                  highlights: {
                    type: "array",
                    description: "Exactly 6 compelling reasons to choose this hotel",
                    items: {
                      type: "object",
                      properties: {
                        icon: {
                          type: "string",
                          description: "Icon name from: MapPin, Target, Star, UtensilsCrossed, Users, Calendar, Waves, Sun, Mountain, Trophy, Heart, Gem, Shield, Compass, Palmtree, Building",
                        },
                        title: {
                          type: "string",
                          description: "Short title in Czech, max 4 words",
                        },
                        text: {
                          type: "string",
                          description: "Description in Czech, 1-2 sentences, max 120 chars",
                        },
                      },
                      required: ["icon", "title", "text"],
                    },
                  },
                },
                required: ["destination", "country", "iso_code", "confidence", "subtitle", "golf_courses", "golf_courses_data", "highlights"],
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
