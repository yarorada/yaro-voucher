import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || text.trim() === "") {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a flight data extraction assistant. Extract ALL flight segments from the provided text.

IMPORTANT: Extract EVERY flight segment separately, including connection flights. 
For a multi-segment journey like PRG->DOH->BKK and back BKK->DOH->PRG, you should extract 4 segments.

For each segment extract:
- Departure airport (IATA code)
- Arrival airport (IATA code)
- Airline code and name
- Flight number
- Date in YYYY-MM-DD format
- Departure time in HH:MM format
- Arrival time in HH:MM format (if available)

Separate outbound segments (going to destination) from return segments (coming back).

Common airport codes:
- PRG = Prague, DOH = Doha, BKK = Bangkok, DXB = Dubai
- AGP = Malaga, ALC = Alicante, BCN = Barcelona, MAD = Madrid
- IST = Istanbul, VIE = Vienna, FRA = Frankfurt, MUC = Munich

If the text mentions a city without the IATA code, try to identify the most likely airport code.
Extract times from formats like "1455" as "14:55", "0210" as "02:10".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract ALL flight segments from this text:\n\n${text}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_flight_data",
              description: "Extract structured flight data with all segments",
              parameters: {
                type: "object",
                properties: {
                  is_one_way: {
                    type: "boolean",
                    description: "True if this is a one-way flight, false for round-trip"
                  },
                  outbound_segments: {
                    type: "array",
                    description: "All outbound flight segments (going to destination)",
                    items: {
                      type: "object",
                      properties: {
                        departure_airport: { type: "string", description: "IATA code of departure airport" },
                        arrival_airport: { type: "string", description: "IATA code of arrival airport" },
                        airline_code: { type: "string", description: "Airline IATA code" },
                        airline_name: { type: "string", description: "Full airline name" },
                        flight_number: { type: "string", description: "Flight number" },
                        date: { type: "string", description: "Flight date in YYYY-MM-DD format" },
                        departure_time: { type: "string", description: "Departure time in HH:MM format" },
                        arrival_time: { type: "string", description: "Arrival time in HH:MM format" }
                      },
                      required: ["departure_airport", "arrival_airport"]
                    }
                  },
                  return_segments: {
                    type: "array",
                    description: "All return flight segments (coming back from destination)",
                    items: {
                      type: "object",
                      properties: {
                        departure_airport: { type: "string", description: "IATA code of departure airport" },
                        arrival_airport: { type: "string", description: "IATA code of arrival airport" },
                        airline_code: { type: "string", description: "Airline IATA code" },
                        airline_name: { type: "string", description: "Full airline name" },
                        flight_number: { type: "string", description: "Flight number" },
                        date: { type: "string", description: "Flight date in YYYY-MM-DD format" },
                        departure_time: { type: "string", description: "Departure time in HH:MM format" },
                        arrival_time: { type: "string", description: "Arrival time in HH:MM format" }
                      }
                    }
                  },
                  price: {
                    type: "number",
                    description: "Price per person if mentioned"
                  },
                  person_count: {
                    type: "number",
                    description: "Number of passengers if mentioned"
                  }
                },
                required: ["outbound_segments"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_flight_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_flight_data") {
      throw new Error("No valid tool call in response");
    }

    const flightData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed flight data:", JSON.stringify(flightData, null, 2));

    return new Response(
      JSON.stringify({ flightData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing flight data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
