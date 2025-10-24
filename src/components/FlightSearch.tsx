import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ExternalLink, Info, ChevronDown, FileText, CheckCircle2, XCircle } from "lucide-react";
import { AirportCombobox } from "./AirportCombobox";
import { Airport } from "@/data/airports";

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
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showTip, setShowTip] = useState(true);

  const isValidIATA = (code: string): boolean => {
    return /^[A-Z]{3}$/.test(code);
  };

  const handleDepartureAirportSelect = (airport: Airport) => {
    setDepartureIata(airport.iata);
    setDepartureAirport(airport.name);
  };

  const handleArrivalAirportSelect = (airport: Airport) => {
    setArrivalIata(airport.iata);
    setArrivalAirport(airport.name);
  };

  const handleIataChange = (value: string, setter: (val: string) => void) => {
    setter(value.toUpperCase().slice(0, 3));
  };

  const handleImportText = () => {
    const text = importText.trim();
    if (!text) return;

    // Regex patterns
    const flightNumberPattern = /(?:Flight|Let|číslo letu|flight number)[:\s]+([A-Z]{2}\s?\d+)/i;
    const airlinePattern = /(?:Airline|Aerolinka|letecká společnost)[:\s]+([A-Za-z\s]+?)(?:\n|$)/i;
    const iataPattern = /\b([A-Z]{3})\b/g;
    const timePattern = /\b(\d{1,2}:\d{2})\b/g;

    // Extract flight number
    const flightMatch = text.match(flightNumberPattern);
    if (flightMatch) {
      setFlightNumber(flightMatch[1].replace(/\s/g, " ").trim());
    }

    // Extract airline
    const airlineMatch = text.match(airlinePattern);
    if (airlineMatch) {
      setAirline(airlineMatch[1].trim());
    }

    // Extract IATA codes
    const iataCodes = text.match(iataPattern);
    if (iataCodes && iataCodes.length >= 2) {
      setDepartureIata(iataCodes[0]);
      setArrivalIata(iataCodes[1]);
    }

    // Extract times
    const times = text.match(timePattern);
    if (times && times.length >= 2) {
      setDepartureTime(times[0]);
      setArrivalTime(times[1]);
    }

    setImportText("");
    setShowImport(false);
  };

  const openFlightradar = () => {
    const searchQuery = flightNumber.trim() || "search";
    window.open(`https://www.flightradar24.com/data/flights/${searchQuery}`, '_blank');
  };

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
      {/* Info Tip Banner */}
      {showTip && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
            <div className="flex items-center justify-between gap-2">
              <span>
                💡 Tip: Použijte tlačítko "Vyhledat na Flightradar24" pro rychlé nalezení detailů vašeho letu
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTip(false)}
                className="h-auto p-1"
              >
                ✕
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Flightradar24 Button */}
      <div className="flex justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={openFlightradar}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Vyhledat na Flightradar24
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Otevře Flightradar24 pro vyhledání vašeho letu. Zkopírujte údaje a vložte je do formuláře níže.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Import from Text */}
      <Collapsible open={showImport} onOpenChange={setShowImport}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-full gap-2">
            <FileText className="h-4 w-4" />
            Import z textu
            <ChevronDown className={`h-4 w-4 transition-transform ${showImport ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card className="p-4 bg-muted">
            <Label>Vložte text z emailu s potvrzením letu</Label>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Vložte text obsahující informace o letu (číslo letu, letiště, časy...)"
              className="mt-2 min-h-[120px]"
              maxLength={2000}
            />
            <Button
              type="button"
              onClick={handleImportText}
              className="mt-3 w-full"
              variant="secondary"
            >
              Analyzovat a vyplnit
            </Button>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Manual Input Form */}
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
                <Label className="flex items-center gap-2">
                  IATA kód *
                  {departureIata && (
                    isValidIATA(departureIata) ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )
                  )}
                </Label>
                <div className="space-y-2">
                  <Input
                    value={departureIata}
                    onChange={(e) => handleIataChange(e.target.value, setDepartureIata)}
                    placeholder="např. VIE"
                    maxLength={3}
                  />
                  <AirportCombobox
                    value={departureIata}
                    onSelect={handleDepartureAirportSelect}
                    placeholder="Nebo vyberte z hlavních letišť"
                  />
                </div>
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
                <Label className="flex items-center gap-2">
                  IATA kód *
                  {arrivalIata && (
                    isValidIATA(arrivalIata) ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )
                  )}
                </Label>
                <div className="space-y-2">
                  <Input
                    value={arrivalIata}
                    onChange={(e) => handleIataChange(e.target.value, setArrivalIata)}
                    placeholder="např. AYT"
                    maxLength={3}
                  />
                  <AirportCombobox
                    value={arrivalIata}
                    onSelect={handleArrivalAirportSelect}
                    placeholder="Nebo vyberte z hlavních letišť"
                  />
                </div>
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
