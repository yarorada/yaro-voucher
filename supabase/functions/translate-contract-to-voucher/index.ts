import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { contractId } = await req.json()

    if (!contractId) {
      throw new Error('Contract ID is required')
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!

    // Create client with user's JWT to respect RLS and verify ownership
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the user's authentication
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // 1. Fetch contract data with ownership verification via RLS
    // Using the authenticated client ensures only the owner can access their contract
    const { data: contract, error: contractError } = await supabaseWithAuth
      .from('travel_contracts')
      .select(`
        *,
        client:clients!travel_contracts_client_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        deal:deals(
          id,
          deal_number,
          destination:destinations(name),
          deal_services(
            service_type,
            service_name,
            description,
            start_date,
            end_date,
            person_count,
            price,
            supplier:suppliers(name)
          )
        )
      `)
      .eq('id', contractId)
      .single()

    if (contractError) {
      console.error('Contract fetch error:', contractError)
      // Return a generic error to avoid leaking information about contract existence
      return new Response(
        JSON.stringify({ error: 'Contract not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Additional ownership verification (defense in depth)
    if (contract.user_id !== userId) {
      console.error('Ownership mismatch: contract belongs to different user')
      return new Response(
        JSON.stringify({ error: 'Contract not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Prepare services for translation
    const servicesToTranslate = contract.deal?.deal_services || []
    
    if (servicesToTranslate.length === 0) {
      throw new Error('No services found in the contract')
    }

    // 3. Translate services using Lovable AI
    // Map services to the voucher format with translation needed for name
    const servicesForTranslation = servicesToTranslate.map((s: any) => ({
      czech_name: s.service_name,
      pax: String(s.person_count || 1),
      qty: "1",
      dateFrom: s.start_date || '',
      dateTo: s.end_date || s.start_date || '',
    }));

    const translationPrompt = `Translate the following travel service names from Czech to English. 
Return ONLY a valid JSON array with the services, no additional text or formatting.
Each service should have: name (translated to English), pax, qty, dateFrom, dateTo.
If the czech_name is already in English, keep it unchanged.
Keep pax, qty, dateFrom, dateTo values exactly as provided.

Services:
${JSON.stringify(servicesForTranslation, null, 2)}

Expected output format:
[
  {
    "name": "Hotel accommodation with breakfast",
    "pax": "2",
    "qty": "1",
    "dateFrom": "2024-05-01",
    "dateTo": "2024-05-08"
  }
]`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator specializing in travel industry terminology. Always respond with valid JSON only, no markdown or additional text.',
          },
          {
            role: 'user',
            content: translationPrompt,
          },
        ],
        max_tokens: 2000,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI API error:', errorText)
      throw new Error(`Translation failed: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const translatedText = aiData.choices[0].message.content.trim()
    
    // Remove markdown code blocks if present
    const jsonText = translatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const translatedServices = JSON.parse(jsonText)

    // 4. Create voucher with translated data using authenticated client
    // This ensures RLS policies are respected for the insert
    const { data: voucher, error: voucherError } = await supabaseWithAuth
      .from('vouchers')
      .insert({
        contract_id: contractId,
        deal_id: contract.deal_id,
        client_id: contract.client_id,
        client_name: `${contract.client.first_name} ${contract.client.last_name}`,
        supplier_id: servicesToTranslate[0]?.supplier?.id || null,
        services: translatedServices,
        issue_date: new Date().toISOString().split('T')[0],
        voucher_number: Math.floor(Math.random() * 10000), // Temporary, will be set by trigger
        user_id: userId, // Use the authenticated user's ID, not from contract
        tee_times: contract.tee_times || null,
      })
      .select()
      .single()

    if (voucherError) {
      console.error('Voucher creation error:', voucherError)
      throw voucherError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        voucher,
        message: 'Voucher created successfully with translated services'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in translate-contract-to-voucher:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
