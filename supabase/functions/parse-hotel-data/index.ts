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

    const systemPrompt = `You are a hotel/accommodation data extraction assistant. Extract hotel booking details from the provided text.

Extract the following information:
- Hotel name
- Room type / room description (e.g. "Deluxe Double Room", "Suite", "Standard Twin")
- Check-in date in YYYY-MM-DD format
- Check-out date in YYYY-MM-DD format
- Number of nights (calculate from dates if not explicit)
- Number of rooms
- Number of guests / persons
- Meal plan / board type (e.g. "BB" = Bed & Breakfast, "HB" = Half Board, "FB" = Full Board, "AI" = All Inclusive, "RO" = Room Only)
- Price per room per night (if mentioned)
- Total price (if mentioned)
- Currency (e.g. EUR, CZK, USD)
- Supplier / booking source name (if mentioned)
- Any special notes or requests

Common meal plan abbreviations:
- RO = Room Only, BB = Bed & Breakfast, HB = Half Board, FB = Full Board, AI = All Inclusive
- Snídaně = Breakfast, Polopenze = Half Board, Plná penze = Full Board

If dates are in European format (DD.MM.YYYY or DD/MM/YYYY), convert to YYYY-MM-DD.
If the text is in Czech, extract all data correctly.`;

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
          { role: "user", content: `Extract hotel/accommodation details from this text:\n\n${text}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_hotel_data",
              description: "Extract structured hotel booking data",
              parameters: {
                type: "object",
                properties: {
                  hotel_name: { type: "string", description: "Name of the hotel" },
                  room_type: { type: "string", description: "Room type or description" },
                  check_in: { type: "string", description: "Check-in date in YYYY-MM-DD format" },
                  check_out: { type: "string", description: "Check-out date in YYYY-MM-DD format" },
                  nights: { type: "number", description: "Number of nights" },
                  rooms: { type: "number", description: "Number of rooms" },
                  persons: { type: "number", description: "Number of guests/persons" },
                  meal_plan: { type: "string", description: "Meal plan code (RO, BB, HB, FB, AI)" },
                  price_per_night: { type: "number", description: "Price per room per night" },
                  total_price: { type: "number", description: "Total price" },
                  currency: { type: "string", description: "Currency code (EUR, CZK, USD, etc.)" },
                  supplier_name: { type: "string", description: "Supplier or booking source name" },
                  notes: { type: "string", description: "Special notes or requests" }
                },
                required: ["hotel_name"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_hotel_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_hotel_data") {
      throw new Error("No valid tool call in response");
    }

    const hotelData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed hotel data:", JSON.stringify(hotelData, null, 2));

    return new Response(
      JSON.stringify({ success: true, hotelData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing hotel data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
