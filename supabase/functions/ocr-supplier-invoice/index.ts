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

    const isPdf = typeof imageBase64 === "string" && imageBase64.startsWith("data:application/pdf");

    const prompt = `Analyze this supplier invoice/document. The document MAY contain MULTIPLE PAGES (e.g. PDF). Inspect ALL pages and combine the most relevant data into a single JSON result. Prefer the page that contains the actual invoice/tax document with totals (skip cover letters, delivery notes, terms & conditions, attachments). If the same field appears on multiple pages, use the one from the main invoice page (typically with "Faktura", "Invoice", "Daňový doklad" header and a total amount).

Extract the following information in JSON format:
{
  "supplier_name": "name of the supplier/company that issued the invoice (string)",
  "supplier_ico": "supplier company ID — Czech IČO / IČ — usually 8 digits, sometimes 6-8 (string or null). Strip spaces.",
  "supplier_dic": "supplier tax ID — DIČ / VAT ID — typically starts with country code like CZ12345678, SK..., DE..., AT..., or just digits (string or null). Strip spaces.",
  "total_amount": "total amount to be paid INCLUDING VAT as a number (number, not string)",
  "net_amount": "amount WITHOUT VAT (základ daně / cena bez DPH) as a number (number or null)",
  "vat_amount": "VAT amount (DPH / daň) as a number (number or null)",
  "currency": "currency code like CZK, EUR, USD, GBP (string, default CZK)",
  "issue_date": "issue date in DD.MM.YYYY format (string)",
  "variable_symbol": "variable symbol / variabilní symbol (string or null)",
  "due_date": "due date / datum splatnosti in DD.MM.YYYY format (string or null)",
  "bank_account": "bank account number in Czech format like 123456789/0100 (string or null)",
  "iban": "IBAN if present on the invoice, normalized without spaces (string or null)"
}

Important:
- For total_amount, return only the numeric value (e.g. 15000, not "15 000 Kč"). This is the TOTAL with VAT included.
- For net_amount, look for "Základ daně", "Cena bez DPH", "Mezisoučet", "Subtotal", "Net amount". If multiple VAT rates, sum bases. If non-VAT (neplátce DPH) set net_amount = total_amount and vat_amount = 0.
- For vat_amount, look for "DPH", "Daň", "VAT amount", "Tax". If multiple rates, sum them. If no VAT, set to 0.
- Sanity check: net_amount + vat_amount ≈ total_amount (±1 unit).
- For issue_date and due_date use DD.MM.YYYY format with 4-digit year.
- Look for "Variabilní symbol", "Var. symbol", "VS" for variable_symbol.
- Look for "Číslo účtu", "Bankovní účet", "Bank account", "Účet" for bank_account (format like 123456789/0100, include prefix like 19-123456789/0100).
- Look for "IČO", "IČ", "Company ID", "Reg. No.", "Identification number" for supplier_ico — return ONLY digits, strip prefix and spaces.
- Look for "DIČ", "VAT", "VAT ID", "Tax ID", "VAT No." for supplier_dic — keep country prefix if present (e.g. CZ12345678).
- supplier_ico and supplier_dic refer to the SUPPLIER (issuer / "Dodavatel"), NOT the customer ("Odběratel").
- For variable_symbol, due_date and bank_account, only extract if currency is CZK; for non-CZK set bank_account to null but DO extract iban if shown.
- Return ONLY the JSON object, no markdown or extra text.
- For multi-page documents: synthesize the best single answer per field, do not concatenate.
- If you cannot find a field, use null`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: isPdf ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No content in AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let extractedData: any = {};
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return new Response(JSON.stringify({ error: "Failed to parse OCR result" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("OCR supplier invoice error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
