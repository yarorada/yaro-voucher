import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token || token.length < 10) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET = fetch contract data for signing page
  if (req.method === 'GET') {
    const { data: contract, error } = await supabase
      .from('travel_contracts')
      .select(`
        id, contract_number, status, contract_date, total_price, deposit_amount, currency, terms,
        signed_at, signature_url,
        agency_name, agency_address, agency_ico, agency_contact, agency_bank_account,
        client:clients(first_name, last_name, email, address, date_of_birth),
        deal:deals(
          start_date, end_date, name,
          destination:destinations(name, country:countries(name)),
          services:deal_services(service_type, service_name, start_date, end_date, person_count, price, description, quantity),
          travelers:deal_travelers(client:clients(first_name, last_name, date_of_birth, passport_number, title))
        ),
        payments:contract_payments(payment_type, amount, due_date, paid)
      `)
      .eq('sign_token', token)
      .single();

    if (error || !contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, contract }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST = submit signature
  if (req.method === 'POST') {
    const { signatureDataUrl, signerName } = await req.json();

    if (!signatureDataUrl || !signerName) {
      return new Response(JSON.stringify({ error: 'Signature and name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify contract exists and is not already signed
    const { data: contract, error: fetchErr } = await supabase
      .from('travel_contracts')
      .select('id, status, signed_at')
      .eq('sign_token', token)
      .single();

    if (fetchErr || !contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contract.signed_at) {
      return new Response(JSON.stringify({ error: 'Contract is already signed' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode base64 signature and upload to storage
    const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const filePath = `${contract.id}/signature-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from('contract-signatures')
      .upload(filePath, bytes, { contentType: 'image/png', upsert: true });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return new Response(JSON.stringify({ error: 'Failed to upload signature' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: urlData } = supabase.storage
      .from('contract-signatures')
      .getPublicUrl(filePath);

    // Get client IP and user agent
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Update contract
    const { error: updateErr } = await supabase
      .from('travel_contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_url: urlData.publicUrl,
        signed_ip: clientIp,
        signed_user_agent: userAgent.slice(0, 500),
      })
      .eq('id', contract.id);

    if (updateErr) {
      console.error('Update error:', updateErr);
      return new Response(JSON.stringify({ error: 'Failed to update contract' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Contract ${contract.id} signed by ${signerName} from ${clientIp}`);

    // Insert notification
    try {
      const { data: contractData } = await supabase
        .from('travel_contracts')
        .select('contract_number, deal_id')
        .eq('id', contract.id)
        .single();

      await supabase.from('notifications').insert({
        event_type: 'contract_signed',
        title: `Smlouva ${contractData?.contract_number || ''} podepsána klientem online`,
        message: `Podepsal: ${signerName}`,
        contract_id: contract.id,
        deal_id: contractData?.deal_id || null,
        link: contractData?.deal_id ? `/deals/${contractData.deal_id}` : `/contracts/${contract.id}`,
      });
    } catch (e) {
      console.error('Notification insert error:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
