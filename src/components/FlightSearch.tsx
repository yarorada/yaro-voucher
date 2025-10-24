import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, Plane, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DateInput } from "@/components/ui/date-input";

interface Flight {
  flightNumber: string;
  airline: string;
  departure: {
    airport: string;
    iata: string;
    time: string;
  };
  arrival: {
    airport: string;
    iata: string;
    time: string;
  };
  status: string;
}

interface FlightSearchProps {
  onSelectFlight: (flight: Flight) => void;
}

export const FlightSearch = ({ onSelectFlight }: FlightSearchProps) => {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);

  const handleSearch = async () => {
    if (!departure.trim() || !arrival.trim() || !date) {
      toast.error("Prosím vyplňte všechna pole");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-flights', {
        body: {
          departure: departure.toUpperCase().trim(),
          arrival: arrival.toUpperCase().trim(),
          date: date.toISOString(),
        }
      });

      if (error) throw error;

      if (data.flights && data.flights.length > 0) {
        setFlights(data.flights);
        toast.success(`Nalezeno ${data.flights.length} letů`);
      } else {
        setFlights([]);
        toast.info("Žádné lety nenalezeny");
      }
    } catch (error: any) {
      console.error('Error searching flights:', error);
      toast.error(`Chyba při hledání letů: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString || timeString === 'N/A') return 'N/A';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeString;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div>
            <Label>Odkud (IATA kód) *</Label>
            <Input
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              placeholder="např. PRG"
              maxLength={3}
            />
          </div>
          <div>
            <Label>Kam (IATA kód) *</Label>
            <Input
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              placeholder="např. LCA"
              maxLength={3}
            />
          </div>
          <div>
            <Label>Datum letu *</Label>
            <DateInput
              value={date}
              onChange={setDate}
              placeholder="DD.MM.YYYY"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Hledám...
                </>
              ) : (
                <>
                  <Plane className="h-4 w-4 mr-2" />
                  Hledat lety
                </>
              )}
            </Button>
          </div>
        </div>

        {flights.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Nalezené lety:</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {flights.map((flight, index) => (
                <Card
                  key={index}
                  className="p-3 bg-card cursor-pointer hover:bg-accent/10 transition-colors"
                  onClick={() => onSelectFlight(flight)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {flight.airline} - {flight.flightNumber}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {flight.departure.iata} ({formatTime(flight.departure.time)}) → {flight.arrival.iata} ({formatTime(flight.arrival.time)})
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFlight(flight);
                      }}
                    >
                      Vybrat
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
