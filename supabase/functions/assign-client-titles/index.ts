import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Authorization header and extract JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Decode JWT to get user ID
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const userId = payload.sub;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Starting title assignment for user:", userId);

    // Use SERVICE_ROLE_KEY for operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch all clients for this user without a title
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, first_name")
      .eq("user_id", userId)
      .is("title", null);

    if (fetchError) {
      throw new Error(`Failed to fetch clients: ${fetchError.message}`);
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No clients to process", updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${clients.length} clients`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each client
    for (const client of clients) {
      try {
        // Ask AI to determine gender based on first name
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
                content: `Based on the first name "${client.first_name}", determine if this is typically a male or female name in Czech/Slovak language. Respond with ONLY one word: either "Pan" (for male) or "Paní" (for female). If uncertain, respond with "Paní".`
              }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`AI gateway error for ${client.first_name}:`, response.status);
          errorCount++;
          continue;
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content?.trim();

        // Validate response
        let title: string;
        if (aiResponse === "Pan" || aiResponse === "Paní") {
          title = aiResponse;
        } else {
          // Default to Paní if AI response is invalid
          console.log(`Invalid AI response for ${client.first_name}: ${aiResponse}, defaulting to Paní`);
          title = "Paní";
        }

        // Update client with determined title
        const { error: updateError } = await supabase
          .from("clients")
          .update({ title })
          .eq("id", client.id);

        if (updateError) {
          console.error(`Failed to update client ${client.id}:`, updateError);
          errorCount++;
          continue;
        }

        updatedCount++;
        console.log(`Updated ${client.first_name} with title: ${title}`);
      } catch (error) {
        console.error(`Error processing client ${client.first_name}:`, error);
        errorCount++;
      }
    }

    console.log(`Title assignment complete: ${updatedCount} clients updated, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tituly přiřazeny`,
        updated: updatedCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in assign-client-titles:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
