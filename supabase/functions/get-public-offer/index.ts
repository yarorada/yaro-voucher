import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isCrawler(userAgent: string): boolean {
  const bots = [
    'bot', 'crawler', 'spider', 'slurp', 'facebookexternalhit', 'linkedinbot',
    'twitterbot', 'whatsapp', 'telegrambot', 'skypeuripreview', 'embedly',
    'quora link preview', 'outbrain', 'pinterest', 'slack', 'vkshare',
    'w3c_validator', 'redditbot', 'applebot', 'yandex', 'baiduspider',
    'googlebot', 'preview', 'fetcher', 'curl', 'wget',
    'outlook', 'thunderbird', 'mailchimp', 'postfix',
  ];
  const ua = userAgent.toLowerCase();
  return bots.some(b => ua.includes(b));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const format = url.searchParams.get('format'); // 'json' or empty

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

    // Serve JSON only when explicitly requested (format=json or has API key/auth header)
    const hasApiKey = req.headers.get('apikey') || req.headers.get('authorization');
    const wantsJson = format === 'json' || hasApiKey;

    // Default: serve OG HTML (for crawlers, email clients, browsers opening the link)
    if (!wantsJson) {
      return await serveOgHtml(supabase, token, url);
    }

    // --- Normal JSON API response below ---

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

async function serveOgHtml(supabase: any, token: string, requestUrl: URL) {
  // Fetch minimal data for OG tags
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id, name, start_date, end_date,
      destination:destinations(name, country:countries(name))
    `)
    .eq('share_token', token)
    .single();

  if (!deal) {
    return new Response('<html><body>Nabídka nenalezena</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Get lead client name
  const { data: leadTraveler } = await supabase
    .from('deal_travelers')
    .select('client:clients(first_name, last_name)')
    .eq('deal_id', deal.id)
    .eq('is_lead_traveler', true)
    .maybeSingle();

  const clientName = leadTraveler?.client
    ? `${(leadTraveler.client as any).first_name} ${(leadTraveler.client as any).last_name}`
    : null;

  // Find hotel image - check variants first, then direct services
  let hotelImageUrl: string | null = null;
  let hotelName: string | null = null;

  // Check variant services
  const { data: variantServices } = await supabase
    .from('deal_variant_services')
    .select('service_name, variant:deal_variants!inner(deal_id, is_selected)')
    .eq('service_type', 'hotel')
    .eq('variant.deal_id', deal.id);

  const selectedHotel = (variantServices || []).find((s: any) => s.variant?.is_selected);
  hotelName = selectedHotel?.service_name || (variantServices || [])[0]?.service_name || null;

  // If no variant hotel, check direct services
  if (!hotelName) {
    const { data: directHotel } = await supabase
      .from('deal_services')
      .select('service_name')
      .eq('deal_id', deal.id)
      .eq('service_type', 'hotel')
      .limit(1)
      .maybeSingle();
    hotelName = directHotel?.service_name || null;
  }

  // Fetch hotel image
  if (hotelName) {
    const { data: hotel } = await supabase
      .from('hotel_templates')
      .select('image_url')
      .eq('name', hotelName)
      .maybeSingle();
    hotelImageUrl = hotel?.image_url || null;
  }

  // Build OG data
  const destination = deal.destination;
  const destText = destination ? `${(destination as any).name}, ${(destination as any).country?.name}` : '';
  
  const title = clientName
    ? `Nabídka zájezdu pro ${clientName}`
    : `Nabídka zájezdu${destText ? ' – ' + destText : ''}`;
  
  const descParts: string[] = [];
  if (destText) descParts.push(destText);
  if (deal.start_date && deal.end_date) {
    descParts.push(`${deal.start_date} – ${deal.end_date}`);
  }
  descParts.push('YARO Travel');
  const description = descParts.join(' · ');

  // The canonical URL should point to the SPA page
  const spaOrigin = requestUrl.origin.replace(/\.supabase\.co.*/, '');
  // We'll use a meta refresh to redirect browsers to the SPA
  const spaUrl = `https://yarogolf-crm.lovable.app/offer/${token}`;

  const fallbackImage = 'https://storage.googleapis.com/gpt-engineer-file-uploads/386hx2FuXMMAPj884A4UlCzLrkf1/social-images/social-1770319524255-e3c320dd-9bb9-495f-8168-f3a847fd03da.jpeg';
  const ogImage = hotelImageUrl || fallbackImage;

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(spaUrl)}">
  <meta property="og:site_name" content="YARO Travel">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}">
</head>
<body>
  <p>Přesměrování na <a href="${escapeHtml(spaUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

  const encoder = new TextEncoder();
  return new Response(encoder.encode(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
