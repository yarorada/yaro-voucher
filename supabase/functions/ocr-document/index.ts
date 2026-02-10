import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to capitalize first letter of each word
function capitalizeWords(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, documentType } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare the prompt based on document type
    let prompt = "";
    if (documentType === "passport") {
      prompt = `Analyze this passport image and extract the following information in JSON format. Be very precise with dates:
{
  "passport_number": "passport number (string)",
  "passport_expiry": "expiry date in DD.MM.YYYY format with 4-digit year (string)",
  "first_name": "first name (string)",
  "last_name": "last name (string)",
  "date_of_birth": "date of birth in DD.MM.YYYY format with 4-digit year (string)"
}

Important:
- For passport_expiry and date_of_birth, format them as DD.MM.YYYY (2 digits for day, 2 for month, 4 digits for year)
- ALWAYS use 4-digit year (e.g. 2034, not 34; 1964, not 64)
- Return only the JSON object, no additional text or markdown
- If you cannot find a field, use null`;
    } else if (documentType === "id_card") {
      prompt = `Analyze this ID card image and extract the following information in JSON format. Be very precise with dates:
{
  "id_card_number": "ID card number (string)",
  "id_card_expiry": "expiry date in DD.MM.YYYY format with 4-digit year (string)",
  "first_name": "first name (string)",
  "last_name": "last name (string)",
  "date_of_birth": "date of birth in DD.MM.YYYY format with 4-digit year (string)"
}

Important:
- For id_card_expiry and date_of_birth, format them as DD.MM.YYYY (2 digits for day, 2 for month, 4 digits for year)
- ALWAYS use 4-digit year (e.g. 2034, not 34; 1964, not 64)
- Return only the JSON object, no additional text or markdown
- If you cannot find a field, use null`;
    } else {
      prompt = `Analyze this document image and extract any relevant personal information (name, document number, expiry date, date of birth) in JSON format.`;
    }

    // Call Lovable AI with vision capability
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
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
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
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content in AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to parse JSON from the response
    let extractedData: any = {};
    try {
      // Extract only the JSON content
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
        
        console.log('Parsed OCR data:', extractedData);
        
        // Capitalize names
        if (extractedData.first_name) {
          extractedData.first_name = capitalizeWords(extractedData.first_name);
        }
        if (extractedData.last_name) {
          extractedData.last_name = capitalizeWords(extractedData.last_name);
        }
        
        console.log('After capitalization:', extractedData);
      }
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      // Return raw content if parsing fails
      return new Response(
        JSON.stringify({ raw_content: content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
