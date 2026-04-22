import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  id_card_number: string | null;
  id_card_expiry: string | null;
  title: string | null;
  company_name: string | null;
  ico: string | null;
  dic: string | null;
  document_urls: any;
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Czech name diacritics mapping - common first names and last names
const czechNameDiacritics: Record<string, string> = {
  // First names
  "jiri": "Jiří",
  "jan": "Jan",
  "petr": "Petr",
  "tomas": "Tomáš",
  "martin": "Martin",
  "vladimir": "Vladimír",
  "karel": "Karel",
  "miroslav": "Miroslav",
  "frantisek": "František",
  "josef": "Josef",
  "vaclav": "Václav",
  "jaroslav": "Jaroslav",
  "milan": "Milan",
  "zdenek": "Zdeněk",
  "pavel": "Pavel",
  "lubos": "Luboš",
  "ludek": "Luděk",
  "ondrej": "Ondřej",
  "ales": "Aleš",
  "radek": "Radek",
  "jakub": "Jakub",
  "lukas": "Lukáš",
  "david": "David",
  "michal": "Michal",
  "adam": "Adam",
  "filip": "Filip",
  "vojtech": "Vojtěch",
  "matej": "Matěj",
  "stepan": "Štěpán",
  "borivoj": "Bořivoj",
  "ivan": "Ivan",
  "tibor": "Tibor",
  "eva": "Eva",
  "jana": "Jana",
  "marie": "Marie",
  "hana": "Hana",
  "anna": "Anna",
  "lenka": "Lenka",
  "katerina": "Kateřina",
  "lucie": "Lucie",
  "petra": "Petra",
  "alena": "Alena",
  "vera": "Věra",
  "jitka": "Jitka",
  "ivana": "Ivana",
  "martina": "Martina",
  "tereza": "Tereza",
  "michaela": "Michaela",
  "alice": "Alice",
  "klara": "Klára",
  "kveta": "Květa",
  "renata": "Renata",
  "simona": "Simona",
  "marketa": "Markéta",
  
  // Common last names
  "novak": "Novák",
  "novakova": "Nováková",
  "svoboda": "Svoboda",
  "svobodova": "Svobodová",
  "novotny": "Novotný",
  "novotna": "Novotná",
  "dvorak": "Dvořák",
  "dvorakova": "Dvořáková",
  "cerny": "Černý",
  "cerna": "Černá",
  "prochazka": "Procházka",
  "prochazkova": "Procházková",
  "kucera": "Kučera",
  "kucerova": "Kučerová",
  "vesely": "Veselý",
  "vesela": "Veselá",
  "horak": "Horák",
  "horakova": "Horáková",
  "nemec": "Němec",
  "nemcova": "Němcová",
  "marek": "Marek",
  "markova": "Marková",
  "pospisil": "Pospíšil",
  "pospisilova": "Pospíšilová",
  "hajek": "Hájek",
  "hajkova": "Hájková",
  "jelinek": "Jelínek",
  "jelinkova": "Jelínková",
  "kratochvil": "Kratochvíl",
  "kratochvilova": "Kratochvílová",
  "kotek": "Kotek",
  "kotkova": "Kotková",
  "frank": "Frank",
  "frankova": "Franková",
  "matousek": "Matoušek",
  "matouskova": "Matoušková",
  "danek": "Daněk",
  "dankova": "Daňková",
  "filip_surname": "Filip",
  "filipova": "Filipová",
  "konvicka": "Konvička",
  "konyvka": "Konývka",
  "karabec": "Karabec",
  "klepal": "Klepal",
  "laube": "Laube",
  "laubova": "Laubová",
  "janulik": "Janulik",
  "janulikova": "Janulíková",
  "junek": "Junek",
  "junkova": "Junková",
  "dutkevic": "Dutkevič",
  "fikes": "Fikeš",
  "bugar": "Bugár",
  "ingala": "Ingala",
  "dockal": "Dočkal",
  "brejsova": "Brejšová",
  "frajbisova": "Frajbišová",
  "myslivcova": "Myslivcová",
  "nguyen": "Nguyen",
  "nyc": "Nyč",
};

function addDiacritics(name: string): string {
  const normalized = removeDiacritics(name.trim().toLowerCase());
  
  // Check if we have a mapping for this name
  if (czechNameDiacritics[normalized]) {
    return czechNameDiacritics[normalized];
  }
  
  // If not found, return original with first letter capitalized
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .order("last_name", { ascending: true });

    if (clientsError) throw clientsError;

    const results = {
      updated: [] as string[],
      merged: [] as string[],
      errors: [] as string[],
    };

    // Group clients by normalized name + date_of_birth
    const clientGroups = new Map<string, Client[]>();
    
    for (const client of clients as Client[]) {
      const normalizedFirst = removeDiacritics(client.first_name.toLowerCase().trim());
      const normalizedLast = removeDiacritics(client.last_name.toLowerCase().trim());
      const dob = client.date_of_birth || "null";
      const key = `${normalizedFirst}|${normalizedLast}|${dob}`;
      
      if (!clientGroups.has(key)) {
        clientGroups.set(key, []);
      }
      clientGroups.get(key)!.push(client);
    }

    // Process each group
    for (const [, group] of clientGroups) {
      // Add diacritics to the first client's name
      const primaryClient = group[0];
      const newFirstName = addDiacritics(primaryClient.first_name);
      const newLastName = addDiacritics(primaryClient.last_name);
      
      if (group.length === 1) {
        // Single client - just update diacritics if changed
        if (newFirstName !== primaryClient.first_name || newLastName !== primaryClient.last_name) {
          const { error: updateError } = await supabase
            .from("clients")
            .update({ 
              first_name: newFirstName, 
              last_name: newLastName 
            })
            .eq("id", primaryClient.id);
          
          if (updateError) {
            results.errors.push(`Error updating ${primaryClient.first_name} ${primaryClient.last_name}: ${updateError.message}`);
          } else {
            results.updated.push(`${primaryClient.first_name} ${primaryClient.last_name} -> ${newFirstName} ${newLastName}`);
          }
        }
      } else {
        // Multiple clients with same name + DOB - merge them
        // Choose the one with most data as primary
        const sortedGroup = [...group].sort((a, b) => {
          // Prioritize the one that already has diacritics
          const aHasDiacritics = a.first_name !== removeDiacritics(a.first_name) || 
                                  a.last_name !== removeDiacritics(a.last_name);
          const bHasDiacritics = b.first_name !== removeDiacritics(b.first_name) || 
                                  b.last_name !== removeDiacritics(b.last_name);
          if (aHasDiacritics && !bHasDiacritics) return -1;
          if (!aHasDiacritics && bHasDiacritics) return 1;
          
          // Then prioritize by amount of data
          const aDataCount = [a.email, a.phone, a.passport_number, a.id_card_number, a.address].filter(Boolean).length;
          const bDataCount = [b.email, b.phone, b.passport_number, b.id_card_number, b.address].filter(Boolean).length;
          return bDataCount - aDataCount;
        });
        
        const primary = sortedGroup[0];
        const duplicates = sortedGroup.slice(1);
        
        // Merge data from duplicates into primary
        const mergedData: Partial<Client> = {
          first_name: addDiacritics(primary.first_name),
          last_name: addDiacritics(primary.last_name),
          email: primary.email,
          phone: primary.phone,
          address: primary.address,
          notes: primary.notes,
          passport_number: primary.passport_number,
          passport_expiry: primary.passport_expiry,
          id_card_number: primary.id_card_number,
          id_card_expiry: primary.id_card_expiry,
          title: primary.title,
          company_name: primary.company_name,
          ico: primary.ico,
          dic: primary.dic,
          document_urls: primary.document_urls || [],
        };
        
        for (const dup of duplicates) {
          // Fill in missing data from duplicates
          if (!mergedData.email && dup.email) mergedData.email = dup.email;
          if (!mergedData.phone && dup.phone) mergedData.phone = dup.phone;
          if (!mergedData.address && dup.address) mergedData.address = dup.address;
          if (!mergedData.passport_number && dup.passport_number) mergedData.passport_number = dup.passport_number;
          if (!mergedData.passport_expiry && dup.passport_expiry) mergedData.passport_expiry = dup.passport_expiry;
          if (!mergedData.id_card_number && dup.id_card_number) mergedData.id_card_number = dup.id_card_number;
          if (!mergedData.id_card_expiry && dup.id_card_expiry) mergedData.id_card_expiry = dup.id_card_expiry;
          if (!mergedData.title && dup.title) mergedData.title = dup.title;
          if (!mergedData.company_name && dup.company_name) mergedData.company_name = dup.company_name;
          if (!mergedData.ico && dup.ico) mergedData.ico = dup.ico;
          if (!mergedData.dic && dup.dic) mergedData.dic = dup.dic;
          
          // Merge notes
          if (dup.notes && dup.notes !== mergedData.notes) {
            mergedData.notes = mergedData.notes 
              ? `${mergedData.notes}\n---\n${dup.notes}` 
              : dup.notes;
          }
          
          // Merge document URLs
          if (dup.document_urls && Array.isArray(dup.document_urls)) {
            mergedData.document_urls = [...(mergedData.document_urls || []), ...dup.document_urls];
          }
        }
        
        // Update primary client with merged data
        const { error: updateError } = await supabase
          .from("clients")
          .update(mergedData)
          .eq("id", primary.id);
        
        if (updateError) {
          results.errors.push(`Error updating primary ${primary.first_name} ${primary.last_name}: ${updateError.message}`);
          continue;
        }
        
        // Update references in other tables
        for (const dup of duplicates) {
          // Update voucher_travelers
          await supabase
            .from("voucher_travelers")
            .update({ client_id: primary.id })
            .eq("client_id", dup.id);
          
          // Update deal_travelers
          await supabase
            .from("deal_travelers")
            .update({ client_id: primary.id })
            .eq("client_id", dup.id);
          
          // Update contract_service_travelers
          await supabase
            .from("contract_service_travelers")
            .update({ client_id: primary.id })
            .eq("client_id", dup.id);
          
          // Update travel_contracts
          await supabase
            .from("travel_contracts")
            .update({ client_id: primary.id })
            .eq("client_id", dup.id);
          
          // Update vouchers
          await supabase
            .from("vouchers")
            .update({ client_id: primary.id })
            .eq("client_id", dup.id);
          
          // Delete duplicate client
          const { error: deleteError } = await supabase
            .from("clients")
            .delete()
            .eq("id", dup.id);
          
          if (deleteError) {
            results.errors.push(`Error deleting duplicate ${dup.first_name} ${dup.last_name}: ${deleteError.message}`);
          }
        }
        
        const dupNames = duplicates.map(d => `${d.first_name} ${d.last_name}`).join(", ");
        results.merged.push(`${mergedData.first_name} ${mergedData.last_name} (merged from: ${dupNames})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          updated: results.updated.length,
          merged: results.merged.length,
          errors: results.errors.length,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
