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
        deal_variant_services(id, service_type, service_name, description, start_date, end_date, price, person_count, order_index, details)
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true });

    // Fetch direct services (non-variant)
    const { data: directServices } = await supabase
      .from('deal_services')
      .select('id, service_type, service_name, description, start_date, end_date, price, person_count, order_index, details')
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

    // Build HTML email - helper to render a single service row
    function renderServiceHtml(s: any): string {
      const details = s.details || {};
      let content = '';

      if (s.service_type === 'flight') {
        const dep = details.departure_airport || '';
        const arr = details.arrival_airport || '';
        const depTime = details.departure_time || '';
        const arrTime = details.arrival_time || '';
        const airline = details.airline || '';
        const flightNum = details.flight_number || '';
        content = `
          <tr>
            <td style="padding:10px 12px; vertical-align:top;">
              <div style="font-size:14px; font-weight:600; color:#1e293b;">✈️ ${escapeHtml(s.service_name)}</div>
              ${dep || arr ? `<div style="font-size:13px; color:#475569; margin-top:4px;">${escapeHtml(dep)}${dep && arr ? ' → ' : ''}${escapeHtml(arr)}</div>` : ''}
              ${depTime || arrTime ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">Odlet: ${escapeHtml(depTime)}${arrTime ? ' · Přílet: ' + escapeHtml(arrTime) : ''}</div>` : ''}
              ${airline || flightNum ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(airline)}${flightNum ? ' ' + escapeHtml(flightNum) : ''}</div>` : ''}
              ${s.start_date ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${formatDate(s.start_date)}</div>` : ''}
              ${s.description ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(s.description)}</div>` : ''}
            </td>
          </tr>`;
      } else if (s.service_type === 'hotel') {
        const hotel = hotelData[s.service_name];
        const nights = s.start_date && s.end_date ? Math.round((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / 86400000) : null;
        content = `
          <tr>
            <td style="padding:0;">
              ${hotel?.image_url ? `<img src="${escapeHtml(hotel.image_url)}" alt="${escapeHtml(s.service_name)}" style="width:100%; max-height:280px; object-fit:cover; display:block;" />` : ''}
              ${(hotel?.image_url_2 || hotel?.image_url_3) ? `
                <table style="width:100%; border-collapse:collapse;"><tr>
                  ${hotel?.image_url_2 ? `<td style="width:50%; padding:2px 1px 0 0;"><img src="${escapeHtml(hotel.image_url_2)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>` : ''}
                  ${hotel?.image_url_3 ? `<td style="width:50%; padding:2px 0 0 1px;"><img src="${escapeHtml(hotel.image_url_3)}" style="width:100%; height:140px; object-fit:cover; display:block;" /></td>` : ''}
                </tr></table>
              ` : ''}
              <div style="padding:12px;">
                <div style="font-size:14px; font-weight:600; color:#1e293b;">🏨 ${escapeHtml(s.service_name)}</div>
                ${s.start_date && s.end_date ? `<div style="font-size:13px; color:#475569; margin-top:4px;">${formatDate(s.start_date)} – ${formatDate(s.end_date)}${nights ? ` (${nights} nocí)` : ''}</div>` : ''}
                ${s.description ? `<div style="font-size:13px; color:#475569; margin-top:4px;">${escapeHtml(s.description)}</div>` : ''}
                ${hotel?.description ? `<div style="font-size:12px; color:#64748b; margin-top:6px; line-height:1.5;">${escapeHtml(hotel.description)}</div>` : ''}
                ${s.person_count && s.person_count > 1 ? `<div style="font-size:12px; color:#94a3b8; margin-top:4px;">${s.person_count} osob</div>` : ''}
              </div>
            </td>
          </tr>`;
      } else if (s.service_type === 'golf') {
        content = `
          <tr>
            <td style="padding:10px 12px; vertical-align:top;">
              <div style="font-size:14px; font-weight:600; color:#1e293b;">⛳ ${escapeHtml(s.service_name)}</div>
              ${s.start_date ? `<div style="font-size:13px; color:#475569; margin-top:4px;">${formatDate(s.start_date)}${s.end_date && s.end_date !== s.start_date ? ' – ' + formatDate(s.end_date) : ''}</div>` : ''}
              ${s.description ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(s.description)}</div>` : ''}
              ${s.person_count && s.person_count > 1 ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${s.person_count} hráčů</div>` : ''}
            </td>
          </tr>`;
      } else {
        const icon = s.service_type === 'transfer' ? '🚗' : s.service_type === 'insurance' ? '🛡️' : '📋';
        const typeLabel = s.service_type === 'transfer' ? 'Transfer' : s.service_type === 'insurance' ? 'Pojištění' : 'Služba';
        content = `
          <tr>
            <td style="padding:10px 12px; vertical-align:top;">
              <div style="font-size:14px; font-weight:600; color:#1e293b;">${icon} ${escapeHtml(s.service_name)}</div>
              ${s.start_date ? `<div style="font-size:13px; color:#475569; margin-top:4px;">${formatDate(s.start_date)}${s.end_date && s.end_date !== s.start_date ? ' – ' + formatDate(s.end_date) : ''}</div>` : ''}
              ${s.description ? `<div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(s.description)}</div>` : ''}
            </td>
          </tr>`;
      }
      return content;
    }

    // Build variant sections
    let variantsHtml = '';
    for (const variant of displayVariants) {
      const v = variant as any;
      const vServices = (v.deal_variant_services || [])
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      const vDest = v.destination;
      const vPrice = v.total_price || vServices.reduce(
        (sum: number, s: any) => sum + (s.price || 0) * (s.person_count || 1), 0
      );

      variantsHtml += `
        <div style="margin-bottom:28px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:#ffffff;">
          ${displayVariants.length > 1 ? `<div style="padding:12px 16px; background:#f1f5f9; border-bottom:1px solid #e2e8f0;">
            <strong style="font-size:15px; color:#1e293b;">${escapeHtml(v.variant_name || 'Varianta')}</strong>
          </div>` : ''}
          ${vDest ? `<div style="padding:12px 16px 0;">
            <h3 style="margin:0; font-size:18px; color:#1e293b;">${escapeHtml(vDest.name)}, ${escapeHtml(vDest.country?.name || '')}</h3>
            ${v.start_date ? `<p style="margin:4px 0 0; color:#64748b; font-size:13px;">${formatDate(v.start_date)} – ${formatDate(v.end_date || '')}</p>` : ''}
          </div>` : ''}
          <table style="width:100%; border-collapse:collapse;">
            ${vServices.map((s: any) => renderServiceHtml(s)).join('')}
          </table>
          ${v.notes ? `<div style="padding:8px 16px; font-size:12px; color:#64748b; background:#fefce8; border-top:1px solid #e2e8f0;">📝 ${escapeHtml(v.notes)}</div>` : ''}
          ${vPrice > 0 ? `
            <div style="padding:16px; border-top:1px solid #e2e8f0; text-align:right;">
              <span style="font-size:13px; color:#64748b;">Celková cena:</span>
              <span style="font-size:22px; font-weight:700; color:#1e293b; margin-left:8px;">${formatPrice(vPrice)} CZK</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Build direct services section (if any)
    const sortedDirectServices = (directServices || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
    let directServicesHtml = '';
    if (sortedDirectServices.length > 0) {
      directServicesHtml = `
        <div style="margin-bottom:28px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:#ffffff;">
          <table style="width:100%; border-collapse:collapse;">
            ${sortedDirectServices.map((s: any) => renderServiceHtml(s)).join('')}
          </table>
        </div>
      `;
    }

    const emailHtml = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:32px 16px;">
    <div style="text-align:center; margin-bottom:24px;">
      <img src="https://yarogolf-crm.lovable.app/assets/yaro-logo-wide-DhQmBkqU.png" alt="YARO Travel" style="height:40px;" />
    </div>
    
    <div style="background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e2e8f0;">
      <p style="font-size:15px; color:#334155; line-height:1.6; margin:0 0 16px;">
        Vážený ${salutation} ${escapeHtml(declinedName)},
      </p>
      <p style="font-size:15px; color:#334155; line-height:1.6; margin:0 0 24px;">
        zasíláme Vám nabídku podle Vašich požadavků${destText ? ` do destinace <strong>${escapeHtml(destText)}</strong>` : ''}${dateRange ? ` v termínu <strong>${dateRange}</strong>` : ''}.
      </p>

      ${variantsHtml}

      ${directServicesHtml}

      <div style="text-align:center; margin-top:24px;">
        <a href="${escapeHtml(publicUrl)}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 32px; border-radius:8px; font-size:15px; font-weight:600;">
          Zobrazit kompletní nabídku online
        </a>
        <p style="margin:8px 0 0; font-size:12px; color:#94a3b8;">Pro nejlepší zobrazení s interaktivními prvky</p>
      </div>
    </div>

    <div style="text-align:center; margin-top:24px; color:#94a3b8; font-size:12px; line-height:1.5;">
      <p style="margin:0;">S pozdravem,<br/><strong style="color:#475569;">YARO Travel</strong></p>
      <p style="margin:8px 0 0;">📞 +420 602 102 108 · ✉️ radek@yarotravel.cz · 🌐 www.yarotravel.cz</p>
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
