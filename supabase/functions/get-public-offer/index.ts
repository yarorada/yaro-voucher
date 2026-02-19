import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch deal by share_token
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        id, deal_number, name, status, start_date, end_date, total_price,
        destination:destinations(id, name, country:countries(id, name, iso_code))
      `)
      .eq('share_token', token)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: 'Offer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lead client name
    const { data: leadTraveler } = await supabase
      .from('deal_travelers')
      .select('client:clients(first_name, last_name)')
      .eq('deal_id', deal.id)
      .eq('is_lead_traveler', true)
      .maybeSingle();

    let leadClientName = leadTraveler?.client
      ? `${(leadTraveler.client as any).first_name} ${(leadTraveler.client as any).last_name}`
      : null;

    // Decline the name to Czech accusative case (for "Nabídka pro ...")
    if (leadClientName) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "Převeď české jméno a příjmení do 4. pádu (akuzativu). Vrať POUZE skloňované jméno, nic jiného. Pokud jméno nelze skloňovat (cizí jméno), vrať ho beze změny. Příklad: Jan Novák → Jana Nováka, Petra Svobodová → Petru Svobodovou.",
                },
                { role: "user", content: leadClientName },
              ],
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const declined = aiData.choices?.[0]?.message?.content?.trim();
            if (declined && declined.length < 200) {
              leadClientName = declined;
            }
          }
        }
      } catch (e) {
        console.error("Name declension error:", e);
      }
    }

    // Fetch variants with services
    const { data: variants } = await supabase
      .from('deal_variants')
      .select(`
        id, variant_name, destination_id, start_date, end_date, total_price, is_selected, notes,
        destination:destinations(id, name, country:countries(id, name, iso_code)),
        deal_variant_services(
          id, service_type, service_name, description, start_date, end_date, price, person_count, details, order_index
        )
      `)
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: true });

    // Fetch direct services (non-variant)
    const { data: directServices } = await supabase
      .from('deal_services')
      .select('id, service_type, service_name, description, start_date, end_date, price, person_count, details, order_index')
      .eq('deal_id', deal.id)
      .order('order_index', { ascending: true });

    // Collect hotel names from services to fetch images
    const hotelNames = new Set<string>();
    
    // From variants
    (variants || []).forEach((v: any) => {
      (v.deal_variant_services || []).forEach((s: any) => {
        if (s.service_type === 'hotel' && s.service_name) {
          hotelNames.add(s.service_name);
        }
      });
    });
    
    // From direct services
    (directServices || []).forEach((s: any) => {
      if (s.service_type === 'hotel' && s.service_name) {
        hotelNames.add(s.service_name);
      }
    });

    // Fetch hotel images and descriptions
    let hotelImages: Record<string, { image_url: string | null; image_url_2: string | null; image_url_3: string | null; description: string | null }> = {};
    if (hotelNames.size > 0) {
      const { data: hotels } = await supabase
        .from('hotel_templates')
        .select('name, image_url, image_url_2, image_url_3, description')
        .in('name', Array.from(hotelNames));

      (hotels || []).forEach((h: any) => {
        hotelImages[h.name] = {
          image_url: h.image_url,
          image_url_2: h.image_url_2,
          image_url_3: h.image_url_3,
          description: h.description,
        };
      });
    }

    // Determine which variants to show
    const selectedVariant = (variants || []).find((v: any) => v.is_selected);
    const displayVariants = selectedVariant ? [selectedVariant] : (variants || []);

    return new Response(JSON.stringify({
      deal: {
        name: deal.name,
        deal_number: deal.deal_number,
        status: deal.status,
        start_date: deal.start_date,
        end_date: deal.end_date,
        total_price: deal.total_price,
        destination: deal.destination,
        lead_client_name: leadClientName,
      },
      variants: displayVariants.map((v: any) => ({
        ...v,
        deal_variant_services: (v.deal_variant_services || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
      })),
      directServices: (directServices || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
      hotelImages,
      hasSelectedVariant: !!selectedVariant,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
