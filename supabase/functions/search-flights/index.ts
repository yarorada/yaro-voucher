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

    const apiKey = Deno.env.get('FLIGHTAWARE_API_KEY');
    
    // If API key is not configured, return empty results with info message
    if (!apiKey) {
      console.log('FLIGHTAWARE_API_KEY not configured, returning empty results');
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

    console.log('Searching flights with FlightAware:', { departure, arrival, date: searchDate });

    // Search for flights using FlightAware AeroAPI
    // Using /flights/search endpoint with origin and destination
    // Query format: -origin {code} -destination {code}
    const queryParams = new URLSearchParams({
      query: `-origin ${departure} -destination ${arrival}`
    });
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/search?${queryParams.toString()}`;
    
    console.log('FlightAware API URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FlightAware API error:', response.status, errorText);
      
      let errorMessage = 'Nepodařilo se načíst lety z FlightAware API';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.title || errorJson.detail) {
          errorMessage = `${errorJson.title || 'Chyba'}: ${errorJson.detail || 'Neznámá chyba'}`;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
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

    console.log('FlightAware response:', JSON.stringify(data, null, 2));

    // Transform FlightAware data to our format
    const flights = (data.flights || [])
      .filter((flight: any) => {
        // Filter by date - only include flights on the requested date
        if (flight.scheduled_out) {
          const flightDate = flight.scheduled_out.split('T')[0];
          return flightDate === searchDate;
        }
        return false;
      })
      .map((flight: any) => ({
        flightNumber: flight.ident || flight.fa_flight_id || 'N/A',
        airline: flight.operator || flight.operator_iata || 'Unknown',
        departure: {
          airport: flight.origin?.name || flight.origin?.city || 'Unknown',
          iata: flight.origin?.code_iata || flight.origin?.code || departure,
          time: flight.scheduled_out || flight.estimated_out || 'N/A',
        },
        arrival: {
          airport: flight.destination?.name || flight.destination?.city || 'Unknown',
          iata: flight.destination?.code_iata || flight.destination?.code || arrival,
          time: flight.scheduled_in || flight.estimated_in || 'N/A',
        },
        status: flight.status || 'scheduled',
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
