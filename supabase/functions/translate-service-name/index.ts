import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODELS = [
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
];

async function tryTranslate(czechName: string, apiKey: string): Promise<string> {
  for (const model of MODELS) {
    try {
      console.log(`Trying model ${model} for: ${czechName}`);
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { 
              role: "system", 
              content: `You are a translator specializing in travel industry terminology. Your task:
1. If the input text is in Czech, translate it to English.
2. If the input text is already in English, return it unchanged.
3. Return ONLY the translation/text, nothing else. No explanations, no quotes.
4. Keep it concise and professional.` 
            },
            { role: "user", content: czechName }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim() || '';
        console.log(`Translation result (${model}):`, result);
        return result;
      }
      
      const errorText = await response.text();
      console.error(`Model ${model} failed (${response.status}):`, errorText);
    } catch (err) {
      console.error(`Model ${model} exception:`, err);
    }
  }
  throw new Error("All translation models failed");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { czechName } = await req.json();
    
    if (!czechName || czechName.trim() === '') {
      return new Response(JSON.stringify({ englishName: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const englishName = await tryTranslate(czechName, LOVABLE_API_KEY);

    return new Response(JSON.stringify({ englishName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in translate-service-name:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
