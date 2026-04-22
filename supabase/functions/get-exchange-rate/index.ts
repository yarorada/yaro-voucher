import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cache exchange rates for 1 hour (CNB updates once a day)
let cachedRates: Map<string, number> = new Map();
let lastFetchTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchCNBRates(): Promise<Map<string, number>> {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (cachedRates.size > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedRates;
  }
  
  try {
    // CNB provides daily exchange rates in text format
    const response = await fetch(
      "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt"
    );
    
    if (!response.ok) {
      throw new Error(`CNB API returned ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.split("\n");
    
    // Skip first two header lines
    // Format: země|měna|množství|kód|kurz
    // e.g., USA|dolar|1|USD|22,450
    
    const rates = new Map<string, number>();
    rates.set("CZK", 1); // Base currency
    
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split("|");
      if (parts.length >= 5) {
        const amount = parseInt(parts[2], 10);
        const code = parts[3];
        // Czech format uses comma as decimal separator
        const rate = parseFloat(parts[4].replace(",", "."));
        
        if (code && !isNaN(rate) && amount > 0) {
          // Store rate per 1 unit of foreign currency
          rates.set(code, rate / amount);
        }
      }
    }
    
    cachedRates = rates;
    lastFetchTime = now;
    
    console.log(`Fetched ${rates.size} exchange rates from CNB`);
    return rates;
    
  } catch (error) {
    console.error("Error fetching CNB rates:", error);
    
    // Return cached rates if available, even if stale
    if (cachedRates.size > 0) {
      return cachedRates;
    }
    
    // Return default rates if no cache available
    const defaultRates = new Map<string, number>();
    defaultRates.set("CZK", 1);
    defaultRates.set("EUR", 25.0);
    defaultRates.set("USD", 23.0);
    defaultRates.set("GBP", 29.0);
    return defaultRates;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { currency, amount } = await req.json();
    
    if (!currency) {
      return new Response(
        JSON.stringify({ error: "Currency code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const rates = await fetchCNBRates();
    const code = currency.toUpperCase();
    
    // If currency is CZK, no conversion needed
    if (code === "CZK") {
      return new Response(
        JSON.stringify({
          rate: 1,
          convertedAmount: amount || null,
          currency: "CZK",
          baseCurrency: "CZK",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const rate = rates.get(code);
    
    if (!rate) {
      return new Response(
        JSON.stringify({ 
          error: `Exchange rate for ${code} not found`,
          availableCurrencies: Array.from(rates.keys())
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const convertedAmount = amount ? Math.round(amount * rate * 100) / 100 : null;
    
    return new Response(
      JSON.stringify({
        rate,
        convertedAmount,
        currency: code,
        baseCurrency: "CZK",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
