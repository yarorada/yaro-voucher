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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch contract data with related information
    const { data: contract, error: contractError } = await supabase
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

    if (contractError) throw contractError

    // 2. Prepare services for translation
    const servicesToTranslate = contract.deal?.deal_services || []
    
    if (servicesToTranslate.length === 0) {
      throw new Error('No services found in the contract')
    }

    // 3. Translate services using Lovable AI
    const translationPrompt = `Translate the following travel services from Czech to English. 
Return ONLY a valid JSON array with translated services, no additional text or formatting.
Each service should have: service_name, description (if exists), and supplier_name (if exists).

Services to translate:
${JSON.stringify(servicesToTranslate, null, 2)}

Example format:
[
  {
    "service_name": "Hotel accommodation",
    "description": "5-star luxury hotel with breakfast included",
    "supplier_name": "Grand Hotel Prague"
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

    // 4. Create voucher with translated data
    const { data: voucher, error: voucherError } = await supabase
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
        user_id: contract.user_id, // Copy user_id from contract
      })
      .select()
      .single()

    if (voucherError) throw voucherError

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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
