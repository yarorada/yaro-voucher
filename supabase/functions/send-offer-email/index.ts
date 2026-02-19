import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price);
}

function formatPriceWithCurrency(price: number, currency?: string): string {
  const formatted = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price);
  if (!currency || currency === 'CZK') return `${formatted} CZK`;
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };
  return `${formatted} ${symbols[currency] || currency}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { dealId } = await req.json();
    if (!dealId) {
      return new Response(JSON.stringify({ error: 'dealId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        id, deal_number, name, start_date, end_date, total_price, share_token,
        destination:destinations(name, country:countries(name))
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: 'Deal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!deal.share_token) {
      return new Response(JSON.stringify({ error: 'Deal has no share token. Generate a share link first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lead client
    const { data: leadTraveler } = await supabase
      .from('deal_travelers')
      .select('client:clients(first_name, last_name, email, title)')
      .eq('deal_id', dealId)
      .eq('is_lead_traveler', true)
      .maybeSingle();

    const client = leadTraveler?.client as any;
    if (!client?.email) {
      return new Response(JSON.stringify({ error: 'Lead client has no email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientFirstName = client.first_name || '';
    const clientLastName = client.last_name || '';
    const clientFullName = `${clientFirstName} ${clientLastName}`.trim();

    // Decline name to accusative using AI
    let declinedName = clientFullName;
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
                content: "Převeď české jméno a příjmení do 5. pádu (vokativu). Vrať POUZE skloňované jméno, nic jiného. Pokud jméno nelze skloňovat (cizí jméno), vrať ho beze změny. Příklad: Jan Novák → Jane Nováku, Petra Svobodová → Petro Svobodová, Jaroslav Rokos → Jaroslave Rokosi, Martin Dvořák → Martine Dvořáku.",
              },
              { role: "user", content: clientFullName },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const declined = aiData.choices?.[0]?.message?.content?.trim();
          if (declined && declined.length < 200) {
            declinedName = declined;
          }
        }
      }
    } catch (e) {
      console.error("Name declension error:", e);
    }

    // Get salutation - "pane" for male, "paní" for female
    // Detect from title or last name ending
    const isFemale = client.title === 'paní' || client.title === 'Paní' || 
      clientLastName.endsWith('ová') || clientLastName.endsWith('á');
    const salutation = isFemale ? 'paní' : 'pane';

    // Build public URL
    const publicUrl = `https://yarogolf-crm.lovable.app/offer/${encodeURIComponent(deal.share_token)}`;

    // Fetch variants with services for the email body
    const { data: variants } = await supabase
      .from('deal_variants')
      .select(`
        id, variant_name, start_date, end_date, total_price, is_selected, notes,
        destination:destinations(name, country:countries(name)),
        deal_variant_services(id, service_type, service_name, description, start_date, end_date, price, price_currency, person_count, quantity, order_index, details)
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true });

    // Fetch direct services (non-variant)
    const { data: directServices } = await supabase
      .from('deal_services')
      .select('id, service_type, service_name, description, start_date, end_date, price, price_currency, person_count, quantity, order_index, details')
      .eq('deal_id', dealId)
      .order('order_index', { ascending: true });

    const selectedVariant = (variants || []).find((v: any) => v.is_selected);
    const displayVariants = selectedVariant ? [selectedVariant] : (variants || []);

    // Collect hotel names for images and descriptions
    const hotelNames = new Set<string>();
    (displayVariants || []).forEach((v: any) => {
      (v.deal_variant_services || []).forEach((s: any) => {
        if (s.service_type === 'hotel') hotelNames.add(s.service_name);
      });
    });
    (directServices || []).forEach((s: any) => {
      if (s.service_type === 'hotel') hotelNames.add(s.service_name);
    });

    let hotelData: Record<string, { image_url: string | null; image_url_2: string | null; image_url_3: string | null; description: string | null }> = {};
    if (hotelNames.size > 0) {
      const { data: hotels } = await supabase
        .from('hotel_templates')
        .select('name, image_url, image_url_2, image_url_3, description')
        .in('name', Array.from(hotelNames));
      (hotels || []).forEach((h: any) => {
        hotelData[h.name] = { image_url: h.image_url, image_url_2: h.image_url_2, image_url_3: h.image_url_3, description: h.description };
      });
    }

    // Destination info
    const dest = deal.destination as any;
    const destText = dest ? `${dest.name}, ${dest.country?.name}` : '';
    const dateRange = deal.start_date && deal.end_date
      ? `${formatDate(deal.start_date)} – ${formatDate(deal.end_date)}`
      : '';

    // Decline name to accusative for the title
    let accusativeName = clientFullName;
    try {
      const LOVABLE_API_KEY2 = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY2) {
        const aiResp2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY2}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "Převeď české jméno a příjmení do 4. pádu (akuzativu). Vrať POUZE skloňované jméno, nic jiného. Pokud jméno nelze skloňovat (cizí jméno), vrať ho beze změny. Příklad: Jan Novák → Jana Nováka, Petra Svobodová → Petru Svobodovou.",
              },
              { role: "user", content: clientFullName },
            ],
          }),
        });
        if (aiResp2.ok) {
          const aiData2 = await aiResp2.json();
          const declined2 = aiData2.choices?.[0]?.message?.content?.trim();
          if (declined2 && declined2.length < 200) {
            accusativeName = declined2;
          }
        }
      }
    } catch (e) {
      console.error("Accusative name error:", e);
    }

    // Helper: format date like the web version "d. MMMM yyyy" in Czech
    const czechMonths = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
    function formatDateLong(dateStr: string): string {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getDate()}. ${czechMonths[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Helper: check if description is real (not just URLs)
    function isValidDescription(text: string | null): boolean {
      if (!text) return false;
      const cleaned = text.replace(/https?:\/\/\S+/g, '').trim();
      return cleaned.length >= 30;
    }

    // Service emoji map
    const serviceEmoji: Record<string, string> = {
      flight: '✈️', hotel: '🏨', golf: '⛳', transfer: '🚗', insurance: '🛡️', other: '📋'
    };

    // Build flight segment HTML matching web version (→ and ← arrows)
    function renderFlightSegments(details: any): string {
      if (!details) return '';
      const segments = details.outbound_segments || (details.outbound ? [details.outbound] : []);
      const returnSegments = details.return_segments || (details.return ? [details.return] : []);
      if (segments.length === 0 && returnSegments.length === 0) return '';

      const fmtSeg = (s: any) => {
        const parts: string[] = [];
        parts.push(`${s.departure || '?'} → ${s.arrival || '?'}`);
        if (s.departure_time || s.arrival_time) parts.push(`${s.departure_time || ''} – ${s.arrival_time || ''}`);
        if (s.date) parts.push(formatDate(s.date));
        if (s.airline && s.flight_number) parts.push(`${s.airline}${s.flight_number}`);
        return parts.join(' · ');
      };

      let html = '';
      if (segments.length > 0) {
        html += `<div style="font-size:12px; color:#94a3b8; margin-top:3px;">→ ${escapeHtml(segments.map(fmtSeg).join(' ✈ '))}</div>`;
      }
      if (returnSegments.length > 0) {
        html += `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">← ${escapeHtml(returnSegments.map(fmtSeg).join(' ✈ '))}</div>`;
      }
      return html;
    }

    // Render a single service line (matching PublicOffer.tsx style)
    function renderServiceLine(s: any): string {
      const emoji = serviceEmoji[s.service_type] || '📋';
      let extra = '';
      if (s.service_type === 'hotel' && (s.quantity || 1) > 1) {
        extra += `<span style="color:#94a3b8; margin-left:4px;">· ${s.quantity}× pokoj</span>`;
      }
      if (s.description) {
        extra += `<span style="color:#94a3b8; margin-left:4px;">· ${escapeHtml(s.description)}</span>`;
      }
      const flightHtml = s.service_type === 'flight' ? renderFlightSegments(s.details) : '';
      return `
        <tr><td style="padding:5px 0; vertical-align:top;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:top; padding-right:10px; font-size:14px; line-height:20px;">${emoji}</td>
            <td style="vertical-align:top;">
              <div style="font-size:14px; line-height:20px;">
                <strong style="color:#334155;">${escapeHtml(s.service_name)}</strong>${extra}
              </div>
              ${flightHtml}
            </td>
          </tr></table>
        </td></tr>`;
    }

    // Per-person price lines
    function computePerPersonLines(services: any[]): Array<{label: string; personCount: number; pricePerPerson: number}> {
      const hotels = services.filter((s: any) => s.service_type === 'hotel');
      const shared = services.filter((s: any) => s.service_type !== 'hotel');
      if (hotels.length === 0) return [];
      let sharedPerPerson = 0;
      shared.forEach((s: any) => {
        const total = (s.price || 0) * (s.quantity || 1);
        sharedPerPerson += total / (s.person_count || 1);
      });
      return hotels.map((h: any) => {
        const persons = h.person_count || 1;
        const hotelPerPerson = ((h.price || 0) * (h.quantity || 1)) / persons;
        return { label: h.description || h.service_name, personCount: persons, pricePerPerson: Math.round(hotelPerPerson + sharedPerPerson) };
      });
    }

    function renderPerPersonHtml(services: any[]): string {
      const lines = computePerPersonLines(services);
      if (lines.length === 0) return '';
      const cur = services.find((s: any) => s.price_currency)?.price_currency || 'CZK';
      return `
        <div style="border-top:1px solid #e2e8f0; padding-top:12px; margin-top:4px;">
          <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Cena na osobu</div>
          ${lines.map(l => `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:4px;"><tr>
              <td style="font-size:13px; color:#475569;">${escapeHtml(l.label)} <span style="color:#94a3b8;">(${l.personCount} os.)</span></td>
              <td style="font-size:13px; font-weight:600; color:#1e293b; text-align:right; white-space:nowrap;">${formatPriceWithCurrency(l.pricePerPerson, cur)}</td>
            </tr></table>
          `).join('')}
        </div>`;
    }

    // Build variant card HTML (matching VariantCard in PublicOffer.tsx)
    function renderVariantCard(v: any, showBadge: boolean): string {
      const vServices = (v.deal_variant_services || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      const hotelSvc = vServices.find((s: any) => s.service_type === 'hotel');
      const images = hotelSvc ? hotelData[hotelSvc.service_name] : null;
      const vDest = v.destination;
      const vPrice = v.total_price || vServices.reduce((sum: number, s: any) => sum + (s.price || 0) * (s.quantity || 1), 0);
      const vCurrency = vServices.find((s: any) => s.price_currency)?.price_currency || 'CZK';

      let imagesHtml = '';
      if (images?.image_url) {
        imagesHtml += `<img src="${escapeHtml(images.image_url)}" alt="${escapeHtml(hotelSvc?.service_name || 'Hotel')}" style="width:100%; display:block; max-height:300px; object-fit:cover;" />`;
      }
      if (images?.image_url_2 || images?.image_url_3) {
        imagesHtml += `<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-top:4px;"><tr>`;
        if (images?.image_url_2) {
          imagesHtml += `<td style="width:50%; padding-right:2px;"><img src="${escapeHtml(images.image_url_2)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>`;
        }
        if (images?.image_url_3) {
          imagesHtml += `<td style="width:50%; padding-left:2px;"><img src="${escapeHtml(images.image_url_3)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>`;
        }
        imagesHtml += `</tr></table>`;
      }

      const badgeHtml = showBadge ? `<div style="padding:12px 20px 0;"><span style="background:#f1f5f9; color:#334155; font-size:12px; font-weight:600; padding:4px 12px; border-radius:999px;">${escapeHtml(v.variant_name || 'Varianta')}</span></div>` : '';

      const descHtml = images && isValidDescription(images.description) ? `<p style="font-size:14px; color:#64748b; line-height:1.6; margin:0 0 8px;">${escapeHtml(images.description!)}</p>` : '';

      return `
        <div style="margin-bottom:28px; border-radius:16px; overflow:hidden; background:#ffffff; border:1px solid #e2e8f0;">
          ${imagesHtml}
          ${!images?.image_url ? badgeHtml : ''}
          <div style="padding:20px;">
            ${images?.image_url && showBadge ? `<div style="margin-bottom:12px;"><span style="background:#f1f5f9; color:#334155; font-size:12px; font-weight:600; padding:4px 12px; border-radius:999px;">${escapeHtml(v.variant_name || 'Varianta')}</span></div>` : ''}
            ${vDest ? `<h3 style="margin:0 0 4px; font-size:18px; color:#1e293b;">${escapeHtml(vDest.name)}, ${escapeHtml(vDest.country?.name || '')}</h3>` : ''}
            ${v.start_date ? `<p style="margin:0 0 12px; color:#94a3b8; font-size:13px;">${formatDate(v.start_date)} – ${formatDate(v.end_date || '')}</p>` : ''}
            ${descHtml}
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              ${vServices.map((s: any) => renderServiceLine(s)).join('')}
            </table>
            ${v.notes ? `<p style="font-size:12px; color:#94a3b8; font-style:italic; border-top:1px solid #e2e8f0; padding-top:12px; margin:12px 0 0;">${escapeHtml(v.notes)}</p>` : ''}
            ${renderPerPersonHtml(vServices)}
            ${vPrice > 0 ? `
              <div style="border-top:1px solid #e2e8f0; padding-top:16px; margin-top:12px;">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
                  <td style="font-size:14px; color:#64748b;">Celková cena</td>
                  <td style="font-size:22px; font-weight:700; color:#1e293b; text-align:right;">${formatPriceWithCurrency(vPrice, vCurrency)}</td>
                </tr></table>
              </div>` : ''}
          </div>
        </div>`;
    }

    // Build variant sections
    let variantsHtml = '';
    for (const variant of displayVariants) {
      variantsHtml += renderVariantCard(variant, displayVariants.length > 1);
    }

    // Build direct services section (only if no variants are displayed, to avoid duplication)
    const sortedDirectServices = (directServices || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
    let directServicesHtml = '';
    if (sortedDirectServices.length > 0 && displayVariants.length === 0) {
      const dHotelSvc = sortedDirectServices.find((s: any) => s.service_type === 'hotel');
      const dImages = dHotelSvc ? hotelData[dHotelSvc.service_name] : null;
      let dImagesHtml = '';
      if (dImages?.image_url) {
        dImagesHtml += `<img src="${escapeHtml(dImages.image_url)}" style="width:100%; display:block; max-height:300px; object-fit:cover;" />`;
      }
      if (dImages?.image_url_2 || dImages?.image_url_3) {
        dImagesHtml += `<table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-top:4px;"><tr>`;
        if (dImages?.image_url_2) dImagesHtml += `<td style="width:50%; padding-right:2px;"><img src="${escapeHtml(dImages.image_url_2)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>`;
        if (dImages?.image_url_3) dImagesHtml += `<td style="width:50%; padding-left:2px;"><img src="${escapeHtml(dImages.image_url_3)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>`;
        dImagesHtml += `</tr></table>`;
      }
      const dDescHtml = dHotelSvc && isValidDescription(hotelData[dHotelSvc.service_name]?.description) ? `<p style="font-size:14px; color:#64748b; line-height:1.6; margin:0 0 8px;">${escapeHtml(hotelData[dHotelSvc.service_name].description!)}</p>` : '';

      directServicesHtml = `
        <div style="margin-bottom:28px; border-radius:16px; overflow:hidden; background:#ffffff; border:1px solid #e2e8f0; max-width:560px; margin-left:auto; margin-right:auto;">
          ${dImagesHtml}
          <div style="padding:20px;">
            ${dDescHtml}
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              ${sortedDirectServices.map((s: any) => renderServiceLine(s)).join('')}
            </table>
            ${deal.total_price && deal.total_price > 0 ? `
              <div style="border-top:1px solid #e2e8f0; padding-top:16px; margin-top:12px;">
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>
                  <td style="font-size:14px; color:#64748b;">Celková cena</td>
                  <td style="font-size:22px; font-weight:700; color:#1e293b; text-align:right;">${formatPriceWithCurrency(deal.total_price, sortedDirectServices.find((s: any) => s.price_currency)?.price_currency || 'CZK')}</td>
                </tr></table>
              </div>` : ''}
            ${renderPerPersonHtml(sortedDirectServices)}
          </div>
        </div>`;
    }

    // Date range in long format matching the web
    const dateRangeLong = deal.start_date && deal.end_date
      ? `${formatDateLong(deal.start_date)} — ${formatDateLong(deal.end_date)}`
      : '';

    const emailHtml = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Header matching PublicOffer -->
  <div style="background:#ffffff; border-bottom:1px solid #e2e8f0;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; margin:0 auto;">
      <tr>
        <td style="padding:12px 16px;">
          <img src="https://yarogolf-crm.lovable.app/assets/yaro-logo-wide-DhQmBkqU.png" alt="YARO Travel" style="height:32px;" />
        </td>
        <td style="padding:12px 16px; text-align:center; font-size:11px; color:#64748b;">
          <a href="tel:+420602102108" style="color:#64748b; text-decoration:none;">📞 +420 602 102 108</a>
          &nbsp;|&nbsp;
          <a href="mailto:radek@yarotravel.cz" style="color:#64748b; text-decoration:none;">✉️ radek@yarotravel.cz</a>
        </td>
        <td style="padding:12px 16px; text-align:right; font-size:12px; font-weight:500; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">
          Nabídka
        </td>
      </tr>
    </table>
  </div>

  <div style="max-width:600px; margin:0 auto; padding:32px 16px;">
    <!-- Title matching PublicOffer -->
    <div style="text-align:center; margin-bottom:28px;">
      <h1 style="margin:0 0 6px; font-size:28px; font-weight:700; color:#1e293b;">
        Nabídka pro ${escapeHtml(accusativeName || clientFullName || 'klienta')}
      </h1>
      ${destText ? `<p style="margin:0 0 2px; font-size:15px; color:#64748b;">${escapeHtml(destText)}</p>` : ''}
      ${dateRangeLong ? `<p style="margin:0; font-size:15px; color:#94a3b8;">${escapeHtml(dateRangeLong)}</p>` : ''}
    </div>

    <!-- Greeting -->
    <div style="margin-bottom:24px;">
      <p style="font-size:15px; color:#334155; line-height:1.6; margin:0 0 8px;">
        Vážený ${salutation} ${escapeHtml(declinedName)},
      </p>
      <p style="font-size:15px; color:#334155; line-height:1.6; margin:0;">
        zasíláme Vám nabídku podle Vašich požadavků.
      </p>
    </div>

    ${variantsHtml}

    ${directServicesHtml}

    <div style="text-align:center; margin-top:28px;">
      <a href="${escapeHtml(publicUrl)}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 32px; border-radius:8px; font-size:15px; font-weight:600;">
        Zobrazit nabídku online
      </a>
    </div>

    <!-- Footer matching PublicOffer -->
    <div style="text-align:center; margin-top:32px; border-top:1px solid #e2e8f0; padding-top:20px; color:#94a3b8; font-size:12px; line-height:1.5;">
      <p style="margin:0;">S pozdravem,<br/><strong style="color:#475569;">YARO Travel</strong></p>
      <p style="margin:8px 0 0;">📞 +420 602 102 108 · ✉️ radek@yarotravel.cz · 🌐 www.yarotravel.cz</p>
      <p style="margin:8px 0 0; font-size:11px;">© ${new Date().getFullYear()} YARO Travel s.r.o. · Bratranců Veverkových 680, Pardubice</p>
    </div>
  </div>
</body>
</html>`;

    const subject = `Nabídka zájezdu${destText ? ' – ' + destText : ''} | YARO Travel`;

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'YARO Travel <radek@yarogolf.cz>',
        to: [client.email],
        bcc: ['zajezdy@yarotravel.cz'],
        subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: err }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resendResponse.json();
    console.log('Offer email sent to', client.email, 'result:', result);

    return new Response(JSON.stringify({ success: true, recipient: client.email }), {
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
