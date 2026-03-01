import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Fetch all vouchers not yet marked as utilized
    const { data: vouchers, error } = await supabase
      .from('vouchers')
      .select('id, expiration_date, services')
      .neq('status', 'utilized');

    if (error) throw error;

    const toMarkUtilized: string[] = [];

    for (const voucher of vouchers || []) {
      let isExpired = false;

      // Check expiration_date
      if (voucher.expiration_date && voucher.expiration_date < todayStr) {
        isExpired = true;
      }

      // Check last service date from services JSON
      if (!isExpired && Array.isArray(voucher.services)) {
        const lastServiceDate = voucher.services
          .map((s: any) => s.dateTo || s.end_date || s.dateFrom || s.start_date)
          .filter(Boolean)
          .sort()
          .slice(-1)[0];

        if (lastServiceDate && lastServiceDate < todayStr) {
          isExpired = true;
        }
      }

      if (isExpired) {
        toMarkUtilized.push(voucher.id);
      }
    }

    if (toMarkUtilized.length > 0) {
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ status: 'utilized' })
        .in('id', toMarkUtilized);

      if (updateError) throw updateError;
    }

    console.log(`Checked ${vouchers?.length || 0} vouchers, marked ${toMarkUtilized.length} as utilized.`);

    return new Response(
      JSON.stringify({ success: true, marked: toMarkUtilized.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
