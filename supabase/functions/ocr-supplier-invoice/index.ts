import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

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

    const prompt = `Analyze this supplier invoice/document image and extract the following information in JSON format:
{
  "supplier_name": "name of the supplier/company that issued the invoice (string)",
  "total_amount": "total amount to be paid as a number (number, not string)",
  "currency": "currency code like CZK, EUR, USD, GBP (string, default CZK)",
  "issue_date": "issue date in DD.MM.YYYY format (string)",
  "variable_symbol": "variable symbol / variabilní symbol (string or null)",
  "due_date": "due date / datum splatnosti in DD.MM.YYYY format (string or null)",
  "bank_account": "bank account number in Czech format like 123456789/0100 (string or null)"
}

Important:
- For total_amount, return only the numeric value (e.g. 15000, not "15 000 Kč")
- For issue_date and due_date, use DD.MM.YYYY format with 4-digit year
- Look for "Datum vystavení", "Date of issue", "Invoice date" etc.
- Look for "Celkem k úhradě", "Total", "Amount due", "Částka" etc.
- Look for "Variabilní symbol", "Var. symbol", "VS" for the variable symbol
- Look for "Datum splatnosti", "Due date", "Splatnost" for the due date
- Look for "Číslo účtu", "Bankovní účet", "Bank account", "Účet" for the bank account number. It is typically in format like 123456789/0100 (account number / bank code). Include the prefix if present (e.g. 19-123456789/0100).
- For variable_symbol, due_date and bank_account, only extract if the currency is CZK (Czech invoice). For non-CZK invoices, set these to null.
- Return only the JSON object, no additional text or markdown
- If you cannot find a field, use null`;

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
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
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
          JSON.stringify({ error: "Payment required. Please add credits." }),
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

    let extractedData: any = {};
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse OCR result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR supplier invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
