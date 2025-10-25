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

    // Try multiple endpoints to find flights
    // 1. First try schedules endpoint for future flights
    // 2. Fall back to search for recent/historical flights
    
    let url = `https://aeroapi.flightaware.com/aeroapi/schedules/${departure}/${arrival}`;
    
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
    // Schedules endpoint returns array directly, not in flights property
    const flightsArray = Array.isArray(data) ? data : (data.flights || []);
    
    const flights = flightsArray
      .map((flight: any) => {
        // Handle both schedule format and flight search format
        const schedOut = flight.scheduled_out || flight.departure_time || flight.scheduled_departure;
        const schedIn = flight.scheduled_in || flight.arrival_time || flight.scheduled_arrival;
        
        return {
          flightNumber: flight.ident || flight.flight_number || flight.fa_flight_id || 'N/A',
          airline: flight.operator || flight.operator_iata || flight.airline || 'Unknown',
          departure: {
            airport: flight.origin?.name || flight.origin?.city || departure,
            iata: flight.origin?.code_iata || flight.origin?.code || departure,
            time: schedOut || 'N/A',
          },
          arrival: {
            airport: flight.destination?.name || flight.destination?.city || arrival,
            iata: flight.destination?.code_iata || flight.destination?.code || arrival,
            time: schedIn || 'N/A',
          },
          status: flight.status || 'scheduled',
        };
      });

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
