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
    const { token, comment, variant_name, variant_id } = await req.json();

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

    // Find deal by share_token
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, deal_number, name, notes')
      .eq('share_token', token)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: 'Offer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get lead traveler info
    const { data: leadTraveler } = await supabase
      .from('deal_travelers')
      .select('client:clients(first_name, last_name, email)')
      .eq('deal_id', deal.id)
      .eq('is_lead_traveler', true)
      .maybeSingle();

    const client = leadTraveler?.client as any;
    const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : 'Neznámý klient';
    const clientEmail = client?.email || null;

    // Save offer response
    const { error: insertError } = await supabase
      .from('offer_responses')
      .insert({
        deal_id: deal.id,
        client_name: clientName,
        client_email: clientEmail,
        comment: variant_name ? `[Varianta: ${variant_name}] ${comment || ''}`.trim() : (comment || null),
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-select variant if variant_id provided
    if (variant_id) {
      // Deselect all variants for this deal
      await supabase
        .from('deal_variants')
        .update({ is_selected: false })
        .eq('deal_id', deal.id);

      // Select the approved variant
      await supabase
        .from('deal_variants')
        .update({ is_selected: true })
        .eq('id', variant_id);
    }

    // Save client comment to deals.notes
    if (comment) {
      const prefix = '📝 Poznámka klienta: ';
      const newNote = prefix + comment;
      const updatedNotes = deal.notes
        ? `${deal.notes}\n\n${newNote}`
        : newNote;

      await supabase
        .from('deals')
        .update({ notes: updatedNotes })
        .eq('id', deal.id);
    }

    // Update deal status to "approved"
    const { error: statusError } = await supabase
      .from('deals')
      .update({ status: 'approved' })
      .eq('id', deal.id);

    if (statusError) {
      console.error('Status update error:', statusError);
    }

    // Insert notification
    try {
      await supabase.from('notifications').insert({
        event_type: 'offer_approved',
        title: `Klient ${clientName} schválil nabídku ${deal.deal_number}`,
        message: variant_name ? `Vybraná varianta: ${variant_name}` : null,
        deal_id: deal.id,
        link: `/deals/${deal.id}`,
      });
    } catch (e) {
      console.error('Notification insert error:', e);
    }

    // Send notification email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const crmUrl = `https://yarogolf-crm.lovable.app/deals/${deal.id}`;
      const commentHtml = comment
        ? `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;color:#334155;font-size:14px;line-height:1.6;">${comment.replace(/\n/g, '<br/>')}</p>`
        : '<p style="color:#94a3b8;font-style:italic;">Bez komentáře</p>';

      const emailHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1e293b;margin-bottom:4px;">✅ Klient souhlasí s nabídkou${variant_name ? ` – ${variant_name}` : ''}</h2>
          <p style="color:#64748b;margin-top:0;">Deal: <strong>${deal.deal_number}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr>
              <td style="padding:8px 12px;background:#f1f5f9;font-size:13px;color:#64748b;width:120px;">Klient</td>
              <td style="padding:8px 12px;background:#f1f5f9;font-size:14px;color:#1e293b;font-weight:600;">${clientName}</td>
            </tr>
            ${clientEmail ? `<tr>
              <td style="padding:8px 12px;font-size:13px;color:#64748b;">E-mail</td>
              <td style="padding:8px 12px;font-size:14px;color:#1e293b;">${clientEmail}</td>
            </tr>` : ''}
          </table>
          <h3 style="color:#334155;font-size:14px;margin-bottom:8px;">Komentář klienta:</h3>
          ${commentHtml}
          <p style="margin-top:24px;">
            <a href="${crmUrl}" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Otevřít deal v CRM</a>
          </p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'YARO CRM <crm@yarotravel.cz>',
            to: ['zajezdy@yarotravel.cz'],
            subject: `✅ Souhlas s nabídkou${variant_name ? ' – ' + variant_name : ''} – ${deal.deal_number} – ${clientName}`,
            html: emailHtml,
          }),
        });
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
