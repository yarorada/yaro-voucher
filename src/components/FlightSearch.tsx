import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";

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
  const [flightNumber, setFlightNumber] = useState("");
  const [airline, setAirline] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [departureIata, setDepartureIata] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [arrivalIata, setArrivalIata] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");

  const handleAddFlight = () => {
    if (!flightNumber.trim() || !airline.trim() || !departureIata.trim() || !arrivalIata.trim() || !departureTime.trim() || !arrivalTime.trim()) {
      return;
    }

    const flight: Flight = {
      flightNumber: flightNumber.trim(),
      airline: airline.trim(),
      departure: {
        airport: departureAirport.trim() || departureIata.trim(),
        iata: departureIata.trim(),
        time: departureTime.trim(),
      },
      arrival: {
        airport: arrivalAirport.trim() || arrivalIata.trim(),
        iata: arrivalIata.trim(),
        time: arrivalTime.trim(),
      },
      status: 'scheduled',
    };

    onSelectFlight(flight);

    // Reset form
    setFlightNumber("");
    setAirline("");
    setDepartureAirport("");
    setDepartureIata("");
    setDepartureTime("");
    setArrivalAirport("");
    setArrivalIata("");
    setArrivalTime("");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Číslo letu *</Label>
            <Input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="např. XQ 191"
              maxLength={20}
            />
          </div>
          <div>
            <Label>Letecká společnost *</Label>
            <Input
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder="např. SunExpress"
              maxLength={50}
            />
          </div>
          
          <div className="md:col-span-2 border-t pt-3 mt-2">
            <h4 className="font-semibold text-sm mb-3">Odlet</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>IATA kód *</Label>
                <Input
                  value={departureIata}
                  onChange={(e) => setDepartureIata(e.target.value)}
                  placeholder="např. VIE"
                  maxLength={3}
                />
              </div>
              <div>
                <Label>Letiště</Label>
                <Input
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value)}
                  placeholder="např. Vienna"
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Čas *</Label>
                <Input
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  placeholder="např. 13:55 – 18:40"
                  maxLength={30}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-3">
            <h4 className="font-semibold text-sm mb-3">Přílet</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>IATA kód *</Label>
                <Input
                  value={arrivalIata}
                  onChange={(e) => setArrivalIata(e.target.value)}
                  placeholder="např. AYT"
                  maxLength={3}
                />
              </div>
              <div>
                <Label>Letiště</Label>
                <Input
                  value={arrivalAirport}
                  onChange={(e) => setArrivalAirport(e.target.value)}
                  placeholder="např. Antalya"
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Čas *</Label>
                <Input
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  placeholder="např. 07:30 – 08:30"
                  maxLength={30}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end mt-3">
            <Button
              type="button"
              onClick={handleAddFlight}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              Přidat let
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
