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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MONETA_API_TOKEN = Deno.env.get("MONETA_API_TOKEN");
    const MONETA_ACCOUNT_ID = Deno.env.get("MONETA_ACCOUNT_ID");

    if (!MONETA_API_TOKEN || !MONETA_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'Moneta API token nebo Account ID není nastaveno' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse optional params from request body
    let daysBack = 7;
    try {
      const body = await req.json();
      if (body?.daysBack) daysBack = Number(body.daysBack);
    } catch (_) { /* no body */ }

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateTo.getDate() - daysBack);

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = dateTo.toISOString().split('T')[0];

    console.log(`Fetching Moneta transactions from ${dateFromStr} to ${dateToStr} for account ${MONETA_ACCOUNT_ID}`);

    const monetaHeaders = {
      'Authorization': `Bearer ${MONETA_API_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Moneta API: try multiple URL patterns
    // Moneta proprietární API (komerční klienti) generuje token přímo v George internetovém bankovnictví
    // Dokumentace: apiportal.moneta.cz
    const ibanClean = MONETA_ACCOUNT_ID.replace(/\s/g, '');
    const ibanMatch = ibanClean.match(/CZ\d{2}(\d{4})(\d{6})(\d{10})/);
    const bareAccountNumber = ibanMatch ? ibanMatch[3] : ibanClean;
    const bankCode = ibanMatch ? ibanMatch[2] : '';

    const accountCandidates = [
      ibanClean,
      bareAccountNumber,
      `${bareAccountNumber}/${bankCode}`,
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // All known Moneta API URL patterns (both Berlin Group PSD2 and proprietary)
    const urlPatterns: string[] = [];
    for (const base of [
      'https://api.moneta.cz/openbanking/v1',
      'https://api.moneta.cz/aisp/v1',
      'https://api.moneta.cz/v1',
      'https://api.moneta.cz/psd2/v1',
    ]) {
      for (const accountId of accountCandidates) {
        urlPatterns.push(`${base}/accounts/${encodeURIComponent(accountId)}/transactions?dateFrom=${dateFromStr}&dateTo=${dateToStr}`);
      }
      // Also try "my" endpoint (some banks use this for single-account tokens)
      urlPatterns.push(`${base}/my/accounts/transactions?dateFrom=${dateFromStr}&dateTo=${dateToStr}`);
      urlPatterns.push(`${base}/accounts/transactions?dateFrom=${dateFromStr}&dateTo=${dateToStr}`);
    }

    let monetaResponse: Response | null = null;
    let monetaUrl = '';

    for (const url of urlPatterns) {
      console.log(`Trying: ${url}`);
      try {
        const resp = await fetch(url, { headers: monetaHeaders });
        console.log(`  → ${resp.status}`);
        if (resp.ok) {
          monetaResponse = resp;
          monetaUrl = url;
          break;
        } else if (resp.status === 401 || resp.status === 403) {
          const errText = await resp.text();
          return new Response(JSON.stringify({
            error: `Moneta API chyba: ${resp.status}`,
            detail: `URL: ${url} — ${errText}`,
            hint: 'Token MONETA_API_TOKEN je neplatný nebo vypršel. Obnovte token v George internetovém bankovnictví nebo na apiportal.moneta.cz.',
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.log(`  → Error: ${e}`);
      }
    }

    if (!monetaResponse) {
      return new Response(JSON.stringify({
        error: 'Moneta API: žádný endpoint nefunguje (všechny vrátily 404)',
        detail: `Vyzkoušeno ${urlPatterns.length} URL variant. První: ${urlPatterns[0]}`,
        hint: 'Správná base URL není známa. Kontaktujte Moneta (qaapi@moneta.cz) nebo ověřte endpoint v dokumentaci na apiportal.moneta.cz. Token musí být generován v George internetovém bankovnictví.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Working Moneta URL: ${monetaUrl}`);

    const monetaData = await monetaResponse.json();
    
    // Moneta API returns transactions in transactions array
    const rawTransactions = monetaData?.transactions || monetaData?.data || [];
    console.log(`Got ${rawTransactions.length} transactions from Moneta`);

    // Filter only credit (incoming) transactions
    const creditTransactions = rawTransactions.filter((t: any) => {
      const amount = t.amount?.value ?? t.amount ?? t.creditDebitIndicator;
      // Accept transactions where amount > 0 or creditDebitIndicator = 'CRDT'
      if (t.creditDebitIndicator === 'CRDT') return true;
      if (typeof t.amount === 'object' && t.amount?.value > 0) return true;
      if (typeof t.amount === 'number' && t.amount > 0) return true;
      return false;
    });

    console.log(`Filtered ${creditTransactions.length} credit transactions`);

    let inserted = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const tx of creditTransactions) {
      // Extract transaction ID for deduplication
      const externalId = tx.transactionId || tx.id || tx.entryReference || null;

      // Skip if already exists
      if (externalId) {
        const { data: existing } = await supabase
          .from('bank_notifications')
          .select('id')
          .eq('external_transaction_id', externalId)
          .single();
        
        if (existing) {
          skipped++;
          continue;
        }
      }

      // Parse fields
      const amount = typeof tx.amount === 'object' ? Math.abs(tx.amount.value ?? 0) : Math.abs(tx.amount ?? 0);
      const variableSymbol = tx.remittanceInformation?.variableSymbol 
        || tx.variableSymbol 
        || tx.details?.variableSymbol
        || extractVS(tx.remittanceInformation?.unstructured || tx.additionalTransactionInformation || '');
      
      const txDate = tx.bookingDate || tx.valueDate || tx.transactionDate || null;
      const senderName = tx.counterParty?.name || tx.creditorName || tx.debtorName || tx.counterpartName || null;
      const senderAccount = tx.counterParty?.accountNumber 
        || (tx.counterParty?.iban) 
        || tx.creditorAccount?.iban 
        || null;
      const note = tx.remittanceInformation?.unstructured 
        || tx.additionalTransactionInformation 
        || tx.transactionNote 
        || null;

      if (!amount || amount <= 0) continue;

      // Match against unpaid payments (same logic as bank-webhook)
      let matchedPaymentId: string | null = null;
      let matchedContractId: string | null = null;

      // Strategy 1: Match by VS
      if (variableSymbol) {
        const vs = variableSymbol.replace(/\D/g, '');
        const { data: contracts } = await supabase
          .from('travel_contracts')
          .select('id, contract_number')
          .or(`contract_number.ilike.%${vs}`);

        if (contracts && contracts.length > 0) {
          for (const contract of contracts) {
            const { data: payments } = await supabase
              .from('contract_payments')
              .select('id, amount')
              .eq('contract_id', contract.id)
              .eq('paid', false)
              .order('due_date', { ascending: true });

            if (payments) {
              const match = payments.find((p: any) => Math.abs(p.amount - amount) <= 1);
              if (match) {
                matchedPaymentId = match.id;
                matchedContractId = contract.id;
                break;
              }
            }
          }
        }
      }

      // Strategy 2: Fallback by amount
      if (!matchedPaymentId) {
        const { data: allUnpaid } = await supabase
          .from('contract_payments')
          .select('id, amount, contract_id')
          .eq('paid', false)
          .order('due_date', { ascending: true });

        if (allUnpaid) {
          const match = allUnpaid.find((p: any) => Math.abs(p.amount - amount) <= 1);
          if (match) {
            matchedPaymentId = match.id;
            matchedContractId = match.contract_id;
          }
        }
      }

      // Insert notification
      const { data: notification, error: insertError } = await supabase
        .from('bank_notifications')
        .insert({
          raw_text: JSON.stringify(tx).slice(0, 5000),
          parsed_amount: amount,
          parsed_vs: variableSymbol || null,
          parsed_date: txDate || null,
          matched_payment_id: matchedPaymentId,
          matched_contract_id: matchedContractId,
          status: 'pending',
          notes: [senderName, note].filter(Boolean).join(' — ') || null,
          external_transaction_id: externalId,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        inserted++;
        results.push({
          id: notification?.id,
          amount,
          vs: variableSymbol,
          matched: !!matchedPaymentId,
        });
      }
    }

    console.log(`Done: inserted=${inserted}, skipped=${skipped}`);

    return new Response(JSON.stringify({
      success: true,
      total_fetched: rawTransactions.length,
      credit_transactions: creditTransactions.length,
      inserted,
      skipped,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("moneta-fetch-transactions error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper: extract variable symbol from free text
function extractVS(text: string): string | null {
  if (!text) return null;
  const match = text.match(/VS[:\s]*(\d{1,10})/i) 
    || text.match(/variabiln[ií]\s+symbol[:\s]*(\d{1,10})/i)
    || text.match(/\bVS\b[:\s]*(\d+)/);
  return match ? match[1] : null;
}
