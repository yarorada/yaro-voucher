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
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MONETA_CLIENT_ID = Deno.env.get("MONETA_CLIENT_ID");
    const MONETA_CLIENT_SECRET = Deno.env.get("MONETA_CLIENT_SECRET");
    const MONETA_ACCOUNT_ID = Deno.env.get("MONETA_ACCOUNT_ID");
    // Legacy support: if no client credentials, try direct token
    const MONETA_API_TOKEN = Deno.env.get("MONETA_API_TOKEN");

    if (!MONETA_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: 'MONETA_ACCOUNT_ID není nastaveno' }), {
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

    console.log(`Fetching Moneta transactions from ${dateFromStr} to ${dateToStr}`);

    // Step 1: Get OAuth2 access token
    let accessToken: string | null = null;

    if (MONETA_CLIENT_ID && MONETA_CLIENT_SECRET) {
      console.log('Attempting OAuth2 client_credentials flow...');
      const tokenUrl = 'https://api.moneta.cz/auth/oauth/v2/token';
      
      // Try client_credentials grant
      const tokenBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: MONETA_CLIENT_ID,
        client_secret: MONETA_CLIENT_SECRET,
        scope: 'aisp',
      });

      try {
        const tokenResp = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenBody.toString(),
        });

        console.log(`OAuth2 token response: ${tokenResp.status}`);
        
        if (tokenResp.ok) {
          const tokenData = await tokenResp.json();
          accessToken = tokenData.access_token;
          console.log('Got OAuth2 access token successfully');
        } else {
          const errText = await tokenResp.text();
          console.log(`OAuth2 token error: ${errText}`);
          
          // Try with MONETA_API_TOKEN as refresh_token if available
          if (MONETA_API_TOKEN) {
            const refreshBody = new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: MONETA_CLIENT_ID,
              client_secret: MONETA_CLIENT_SECRET,
              refresh_token: MONETA_API_TOKEN,
            });
            const refreshResp = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: refreshBody.toString(),
            });
            console.log(`OAuth2 refresh_token response: ${refreshResp.status}`);
            if (refreshResp.ok) {
              const refreshData = await refreshResp.json();
              accessToken = refreshData.access_token;
              console.log('Got access token via refresh_token');
            }
          }
        }
      } catch (e) {
        console.log(`OAuth2 token fetch error: ${e}`);
      }
    }

    // Fallback: use MONETA_API_TOKEN directly as Bearer token
    if (!accessToken && MONETA_API_TOKEN) {
      console.log('No OAuth2 token obtained, using MONETA_API_TOKEN directly as Bearer');
      accessToken = MONETA_API_TOKEN;
    }

    if (!accessToken) {
      return new Response(JSON.stringify({
        error: 'Nelze získat přístupový token Moneta API',
        hint: 'Nastavte MONETA_CLIENT_ID a MONETA_CLIENT_SECRET z Moneta API portálu (apiportal.moneta.cz), nebo MONETA_API_TOKEN jako přímý Bearer token.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Call transactions API
    const ibanClean = MONETA_ACCOUNT_ID.replace(/\s/g, '');
    const ibanMatch = ibanClean.match(/CZ\d{2}(\d{4})(\d{6})(\d{10})/);
    const bareAccountNumber = ibanMatch ? ibanMatch[3] : ibanClean.split('/')[0];
    const bankCode = ibanMatch ? ibanMatch[2] : (ibanClean.includes('/') ? ibanClean.split('/')[1] : '0600');

    const authHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };

    const MONETA_BASE_URL = Deno.env.get("MONETA_BASE_URL");
    const basesToTry = MONETA_BASE_URL
      ? [MONETA_BASE_URL.replace(/\/$/, '')]
      : [
          'https://api.moneta.cz/aisp/v3',
          'https://api.moneta.cz/aisp/v2',
          'https://api.moneta.cz/aisp/v1',
          'https://api.moneta.cz/api/aisp/v3',
          'https://api.moneta.cz/api/aisp/v2',
          'https://api.moneta.cz/api/aisp/v1',
          'https://api.moneta.cz/openbanking/v3',
          'https://api.moneta.cz/openbanking/v2',
          'https://api.moneta.cz/openbanking/v1',
          'https://api.moneta.cz/api/v3',
          'https://api.moneta.cz/api/v2',
          'https://api.moneta.cz/api/v1',
        ];

    // Build account ID candidates including IBAN variants
    const accountCandidates = [
      ibanClean, // full IBAN if provided
      `${bareAccountNumber}/${bankCode}`,
      bareAccountNumber,
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    let monetaResponse: Response | null = null;
    let monetaUrl = '';
    let workingBase = '';

    // Step 2a: Try to discover account via /accounts endpoint first
    for (const base of basesToTry) {
      try {
        const accountsUrl = `${base}/accounts`;
        console.log(`Trying accounts discovery: ${accountsUrl}`);
        const accountsResp = await fetch(accountsUrl, { headers: authHeaders });
        console.log(`  → ${accountsResp.status}`);
        if (accountsResp.ok) {
          const accountsData = await accountsResp.json();
          console.log(`Accounts response: ${JSON.stringify(accountsData).slice(0, 500)}`);
          workingBase = base;
          // Extract account IDs from response
          const accounts = accountsData?.accounts || accountsData?.data || [];
          for (const acc of accounts) {
            const discoveredId = acc.id || acc.accountId || acc.resourceId || acc.iban;
            if (discoveredId) accountCandidates.unshift(discoveredId);
          }
          break;
        } else if (accountsResp.status === 401 || accountsResp.status === 403) {
          const errText = await accountsResp.text();
          return new Response(JSON.stringify({
            error: `Moneta API autorizační chyba: ${accountsResp.status}`,
            detail: errText,
            hint: 'Access token je neplatný nebo nemá oprávnění AISP. Zkontrolujte MONETA_CLIENT_ID a MONETA_CLIENT_SECRET na apiportal.moneta.cz.',
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.log(`  → Error: ${e}`);
      }
    }

    // Step 2b: Try transaction endpoints
    const basesForTx = workingBase ? [workingBase, ...basesToTry.filter(b => b !== workingBase)] : basesToTry;
    const uniqueAccountCandidates = [...new Set(accountCandidates)];

    for (const base of basesForTx) {
      for (const accountId of uniqueAccountCandidates) {
        const url = `${base}/accounts/${encodeURIComponent(accountId)}/transactions?dateFrom=${dateFromStr}&dateTo=${dateToStr}`;
        console.log(`Trying: ${url}`);
        try {
          const resp = await fetch(url, { headers: authHeaders });
          console.log(`  → ${resp.status}`);
          if (resp.ok) {
            monetaResponse = resp;
            monetaUrl = url;
            break;
          } else if (resp.status === 401 || resp.status === 403) {
            const errText = await resp.text();
            return new Response(JSON.stringify({
              error: `Moneta API autorizační chyba: ${resp.status}`,
              detail: errText,
              hint: 'Access token je neplatný nebo nemá oprávnění AISP. Zkontrolujte MONETA_CLIENT_ID a MONETA_CLIENT_SECRET na apiportal.moneta.cz.',
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          console.log(`  → Error: ${e}`);
        }
      }
      if (monetaResponse) break;
    }

    if (!monetaResponse) {
      return new Response(JSON.stringify({
        error: 'Moneta API: žádný endpoint nefunguje (všechny vrátily 404)',
        detail: `Zkontrolujte MONETA_ACCOUNT_ID (${ibanClean}) a MONETA_API_TOKEN. Pokud znáte přesnou URL z dokumentace, nastavte secret MONETA_BASE_URL (např. https://api.moneta.cz/openbanking/v1).`,
        hint: 'Přihlaste se do George IB > Nastavení > Napojení třetích stran / API. Tam byste měli vidět URL endpointu. Případně kontaktujte Moneta na qaapi@moneta.cz.',
        tried_bases: basesToTry,
        tried_accounts: uniqueAccountCandidates,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Working Moneta URL: ${monetaUrl}`);

    const monetaData = await monetaResponse.json();
    const rawTransactions = monetaData?.transactions || monetaData?.data || [];
    console.log(`Got ${rawTransactions.length} transactions from Moneta`);

    // Filter only credit (incoming) transactions
    const creditTransactions = rawTransactions.filter((t: any) => {
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
      const externalId = tx.transactionId || tx.id || tx.entryReference || null;

      if (externalId) {
        const { data: existing } = await supabase
          .from('bank_notifications')
          .select('id')
          .eq('external_transaction_id', externalId)
          .single();
        if (existing) { skipped++; continue; }
      }

      const amount = typeof tx.amount === 'object' ? Math.abs(tx.amount.value ?? 0) : Math.abs(tx.amount ?? 0);
      const variableSymbol = tx.remittanceInformation?.variableSymbol
        || tx.variableSymbol
        || tx.details?.variableSymbol
        || extractVS(tx.remittanceInformation?.unstructured || tx.additionalTransactionInformation || '');

      const txDate = tx.bookingDate || tx.valueDate || tx.transactionDate || null;
      const senderName = tx.counterParty?.name || tx.creditorName || tx.debtorName || tx.counterpartName || null;
      const note = tx.remittanceInformation?.unstructured || tx.additionalTransactionInformation || tx.transactionNote || null;

      if (!amount || amount <= 0) continue;

      let matchedPaymentId: string | null = null;
      let matchedContractId: string | null = null;

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
        results.push({ id: notification?.id, amount, vs: variableSymbol, matched: !!matchedPaymentId });
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

function extractVS(text: string): string | null {
  if (!text) return null;
  const match = text.match(/VS[:\s]*(\d{1,10})/i)
    || text.match(/variabiln[ií]\s+symbol[:\s]*(\d{1,10})/i)
    || text.match(/\bVS\b[:\s]*(\d+)/);
  return match ? match[1] : null;
}
