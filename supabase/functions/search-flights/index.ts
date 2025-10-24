import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { departure, arrival, date } = await req.json();
    
    if (!departure || !arrival || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: departure, arrival, date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('AVIATIONSTACK_API_KEY');
    if (!apiKey) {
      console.error('AVIATIONSTACK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format date for API (YYYY-MM-DD)
    const searchDate = new Date(date).toISOString().split('T')[0];

    console.log('Searching flights:', { departure, arrival, date: searchDate });

    // Search for flights using AviationStack API
    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&dep_iata=${departure}&arr_iata=${arrival}&flight_date=${searchDate}&limit=10`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('AviationStack API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch flights from AviationStack API', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    console.log('AviationStack response:', JSON.stringify(data, null, 2));

    // Transform the data to a simpler format
    const flights = (data.data || []).map((flight: any) => ({
      flightNumber: flight.flight?.iata || flight.flight?.number || 'N/A',
      airline: flight.airline?.name || 'Unknown',
      departure: {
        airport: flight.departure?.airport || 'Unknown',
        iata: flight.departure?.iata || departure,
        time: flight.departure?.scheduled || flight.departure?.estimated || 'N/A',
      },
      arrival: {
        airport: flight.arrival?.airport || 'Unknown',
        iata: flight.arrival?.iata || arrival,
        time: flight.arrival?.scheduled || flight.arrival?.estimated || 'N/A',
      },
      status: flight.flight_status || 'scheduled',
    }));

    return new Response(
      JSON.stringify({ flights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-flights function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
