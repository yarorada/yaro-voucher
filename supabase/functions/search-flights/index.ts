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
    
    // If API key is not configured, return empty results with info message
    if (!apiKey) {
      console.log('AVIATIONSTACK_API_KEY not configured, returning empty results');
      return new Response(
        JSON.stringify({ 
          flights: [],
          message: 'Vyhledávání letů není dostupné. Zadejte údaje o letu ručně.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format date for API (YYYY-MM-DD)
    const searchDate = new Date(date).toISOString().split('T')[0];

    console.log('Searching flights with AviationStack:', { departure, arrival, date: searchDate });

    // Use AviationStack routes endpoint to find flights
    const url = `http://api.aviationstack.com/v1/routes?access_key=${apiKey}&dep_iata=${departure}&arr_iata=${arrival}`;
    
    console.log('AviationStack API URL (key hidden):', url.replace(apiKey, '***'));
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('AviationStack API error:', response.status, errorText);
      
      let errorMessage = 'Nepodařilo se načíst lety z AviationStack API';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = `Chyba: ${errorJson.error.message || errorJson.error.info || 'Neznámá chyba'}`;
        }
      } catch (e) {
        // Keep default error message
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    console.log('AviationStack response:', JSON.stringify(data, null, 2));

    // Transform AviationStack data to our format
    const routes = data.data || [];
    
    const flights = routes
      .slice(0, 10) // Limit to first 10 routes
      .map((route: any, index: number) => ({
        flightNumber: route.flight_number || route.airline?.iata_code + (index + 1) || 'N/A',
        airline: route.airline?.name || route.airline?.iata_code || 'Unknown',
        departure: {
          airport: route.departure?.airport || departure,
          iata: route.departure?.iata || departure,
          time: 'Varies', // Routes don't have specific times
        },
        arrival: {
          airport: route.arrival?.airport || arrival,
          iata: route.arrival?.iata || arrival,
          time: 'Varies',
        },
        status: 'route',
      }));

    // If no flights found, return with info message
    const responseBody = flights.length > 0 
      ? { flights }
      : { 
          flights: [], 
          message: 'Nebyly nalezeny žádné přímé lety. Zadejte údaje o letu ručně.' 
        };

    return new Response(
      JSON.stringify(responseBody),
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
