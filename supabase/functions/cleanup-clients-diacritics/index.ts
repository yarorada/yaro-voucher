import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const removeDiacritics = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user from already verified JWT (JWT is verified by Supabase automatically)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Starting diacritics cleanup for user:", user.id);

    // Use SERVICE_ROLE_KEY for operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all clients for this user
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id);

    if (fetchError) {
      throw new Error(`Failed to fetch clients: ${fetchError.message}`);
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No clients to process", updated: 0, merged: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${clients.length} clients`);

    // Group clients by normalized name
    const clientGroups = new Map<string, any[]>();
    
    for (const client of clients) {
      const normalizedFirstName = removeDiacritics(client.first_name.trim());
      const normalizedLastName = removeDiacritics(client.last_name.trim());
      const key = `${normalizedFirstName}|${normalizedLastName}`;
      
      if (!clientGroups.has(key)) {
        clientGroups.set(key, []);
      }
      clientGroups.get(key)!.push(client);
    }

    let updatedCount = 0;
    let mergedCount = 0;

    // Process each group
    for (const [key, group] of clientGroups.entries()) {
      const [normalizedFirstName, normalizedLastName] = key.split('|');
      
      // Sort by created_at to keep the oldest one
      group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const keepClient = group[0];
      const duplicates = group.slice(1);

      // Update the kept client with normalized names
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
        })
        .eq("id", keepClient.id);

      if (updateError) {
        console.error(`Failed to update client ${keepClient.id}:`, updateError);
        continue;
      }

      updatedCount++;

      // Merge duplicates
      if (duplicates.length > 0) {
        for (const duplicate of duplicates) {
          // Update all voucher_travelers references to point to keepClient
          const { error: updateTravelersError } = await supabase
            .from("voucher_travelers")
            .update({ client_id: keepClient.id })
            .eq("client_id", duplicate.id);

          if (updateTravelersError) {
            console.error(`Failed to update voucher_travelers for duplicate ${duplicate.id}:`, updateTravelersError);
            continue;
          }

          // Delete the duplicate client
          const { error: deleteError } = await supabase
            .from("clients")
            .delete()
            .eq("id", duplicate.id);

          if (deleteError) {
            console.error(`Failed to delete duplicate ${duplicate.id}:`, deleteError);
            continue;
          }

          mergedCount++;
        }
      }
    }

    console.log(`Cleanup complete: ${updatedCount} clients updated, ${mergedCount} duplicates merged`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Diacritics removed and duplicates merged",
        updated: updatedCount,
        merged: mergedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in cleanup-clients-diacritics:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
