import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Airport {
  iata: string;
  city: string;
  name: string;
  country: string;
}

const airports: Airport[] = [
  // Czech Republic
  { iata: "PRG", city: "Praha", name: "Václav Havel Airport Prague", country: "CZ" },
  { iata: "BRQ", city: "Brno", name: "Brno-Tuřany Airport", country: "CZ" },
  { iata: "OSR", city: "Ostrava", name: "Leoš Janáček Airport", country: "CZ" },
  { iata: "PED", city: "Pardubice", name: "Pardubice Airport", country: "CZ" },
  
  // Turkey
  { iata: "IST", city: "Istanbul", name: "Istanbul Airport", country: "TR" },
  { iata: "SAW", city: "Istanbul", name: "Sabiha Gökçen Airport", country: "TR" },
  { iata: "AYT", city: "Antalya", name: "Antalya Airport", country: "TR" },
  { iata: "DLM", city: "Dalaman", name: "Dalaman Airport", country: "TR" },
  { iata: "BJV", city: "Bodrum", name: "Bodrum-Milas Airport", country: "TR" },
  { iata: "ESB", city: "Ankara", name: "Esenboğa Airport", country: "TR" },
  { iata: "ADB", city: "Izmir", name: "Adnan Menderes Airport", country: "TR" },
  { iata: "GZT", city: "Gaziantep", name: "Gaziantep Airport", country: "TR" },
  { iata: "ASR", city: "Kayseri", name: "Kayseri Airport", country: "TR" },
  { iata: "TZX", city: "Trabzon", name: "Trabzon Airport", country: "TR" },
  
  // Cyprus
  { iata: "LCA", city: "Larnaca", name: "Larnaca Airport", country: "CY" },
  { iata: "PFO", city: "Paphos", name: "Paphos Airport", country: "CY" },
  { iata: "ECN", city: "Ercan", name: "Ercan Airport", country: "CY" },
  
  // Greece
  { iata: "ATH", city: "Athens", name: "Athens International Airport", country: "GR" },
  { iata: "HER", city: "Heraklion", name: "Heraklion Airport", country: "GR" },
  { iata: "RHO", city: "Rhodes", name: "Rhodes Airport", country: "GR" },
  { iata: "SKG", city: "Thessaloniki", name: "Thessaloniki Airport", country: "GR" },
  { iata: "CFU", city: "Corfu", name: "Corfu Airport", country: "GR" },
  { iata: "CHQ", city: "Chania", name: "Chania Airport", country: "GR" },
  { iata: "JMK", city: "Mykonos", name: "Mykonos Airport", country: "GR" },
  { iata: "JTR", city: "Santorini", name: "Santorini Airport", country: "GR" },
  { iata: "KGS", city: "Kos", name: "Kos Airport", country: "GR" },
  { iata: "ZTH", city: "Zakynthos", name: "Zakynthos Airport", country: "GR" },
  
  // Middle East
  { iata: "DXB", city: "Dubai", name: "Dubai International Airport", country: "AE" },
  { iata: "AUH", city: "Abu Dhabi", name: "Abu Dhabi International Airport", country: "AE" },
  { iata: "DOH", city: "Doha", name: "Hamad International Airport", country: "QA" },
  { iata: "BEY", city: "Beirut", name: "Beirut-Rafic Hariri Airport", country: "LB" },
  { iata: "TLV", city: "Tel Aviv", name: "Ben Gurion Airport", country: "IL" },
  { iata: "AMM", city: "Amman", name: "Queen Alia International Airport", country: "JO" },
  
  // Egypt
  { iata: "CAI", city: "Cairo", name: "Cairo International Airport", country: "EG" },
  { iata: "SSH", city: "Sharm El Sheikh", name: "Sharm El Sheikh Airport", country: "EG" },
  { iata: "HRG", city: "Hurghada", name: "Hurghada Airport", country: "EG" },
  { iata: "RMF", city: "Marsa Alam", name: "Marsa Alam Airport", country: "EG" },
  
  // Central Europe
  { iata: "VIE", city: "Vienna", name: "Vienna International Airport", country: "AT" },
  { iata: "MUC", city: "Munich", name: "Munich Airport", country: "DE" },
  { iata: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "DE" },
  { iata: "BER", city: "Berlin", name: "Berlin Brandenburg Airport", country: "DE" },
  { iata: "HAM", city: "Hamburg", name: "Hamburg Airport", country: "DE" },
  { iata: "DUS", city: "Düsseldorf", name: "Düsseldorf Airport", country: "DE" },
  { iata: "STR", city: "Stuttgart", name: "Stuttgart Airport", country: "DE" },
  { iata: "CGN", city: "Cologne", name: "Cologne Bonn Airport", country: "DE" },
  { iata: "ZRH", city: "Zurich", name: "Zurich Airport", country: "CH" },
  { iata: "GVA", city: "Geneva", name: "Geneva Airport", country: "CH" },
  { iata: "BUD", city: "Budapest", name: "Budapest Ferenc Liszt Airport", country: "HU" },
  { iata: "WAW", city: "Warsaw", name: "Warsaw Chopin Airport", country: "PL" },
  { iata: "KRK", city: "Krakow", name: "Kraków Airport", country: "PL" },
  { iata: "BTS", city: "Bratislava", name: "Bratislava Airport", country: "SK" },
  
  // Western Europe
  { iata: "CDG", city: "Paris", name: "Charles de Gaulle Airport", country: "FR" },
  { iata: "ORY", city: "Paris", name: "Orly Airport", country: "FR" },
  { iata: "LHR", city: "London", name: "London Heathrow Airport", country: "GB" },
  { iata: "LGW", city: "London", name: "London Gatwick Airport", country: "GB" },
  { iata: "STN", city: "London", name: "London Stansted Airport", country: "GB" },
  { iata: "LTN", city: "London", name: "London Luton Airport", country: "GB" },
  { iata: "MAN", city: "Manchester", name: "Manchester Airport", country: "GB" },
  { iata: "EDI", city: "Edinburgh", name: "Edinburgh Airport", country: "GB" },
  { iata: "AMS", city: "Amsterdam", name: "Amsterdam Schiphol Airport", country: "NL" },
  { iata: "BRU", city: "Brussels", name: "Brussels Airport", country: "BE" },
  { iata: "LUX", city: "Luxembourg", name: "Luxembourg Airport", country: "LU" },
  
  // Southern Europe
  { iata: "FCO", city: "Rome", name: "Fiumicino Airport", country: "IT" },
  { iata: "MXP", city: "Milan", name: "Milan Malpensa Airport", country: "IT" },
  { iata: "LIN", city: "Milan", name: "Milan Linate Airport", country: "IT" },
  { iata: "VCE", city: "Venice", name: "Venice Marco Polo Airport", country: "IT" },
  { iata: "NAP", city: "Naples", name: "Naples Airport", country: "IT" },
  { iata: "PSA", city: "Pisa", name: "Pisa Airport", country: "IT" },
  { iata: "BCN", city: "Barcelona", name: "Barcelona-El Prat Airport", country: "ES" },
  { iata: "MAD", city: "Madrid", name: "Madrid-Barajas Airport", country: "ES" },
  { iata: "AGP", city: "Malaga", name: "Malaga Airport", country: "ES" },
  { iata: "PMI", city: "Palma de Mallorca", name: "Palma de Mallorca Airport", country: "ES" },
  { iata: "VLC", city: "Valencia", name: "Valencia Airport", country: "ES" },
  { iata: "SVQ", city: "Seville", name: "Seville Airport", country: "ES" },
  { iata: "LIS", city: "Lisbon", name: "Lisbon Airport", country: "PT" },
  { iata: "OPO", city: "Porto", name: "Porto Airport", country: "PT" },
  { iata: "FAO", city: "Faro", name: "Faro Airport", country: "PT" },
  
  // Scandinavia
  { iata: "CPH", city: "Copenhagen", name: "Copenhagen Airport", country: "DK" },
  { iata: "OSL", city: "Oslo", name: "Oslo Airport", country: "NO" },
  { iata: "ARN", city: "Stockholm", name: "Stockholm Arlanda Airport", country: "SE" },
  { iata: "HEL", city: "Helsinki", name: "Helsinki Airport", country: "FI" },
  
  // Eastern Europe
  { iata: "SVO", city: "Moscow", name: "Sheremetyevo Airport", country: "RU" },
  { iata: "DME", city: "Moscow", name: "Domodedovo Airport", country: "RU" },
  { iata: "LED", city: "St. Petersburg", name: "Pulkovo Airport", country: "RU" },
  { iata: "KBP", city: "Kyiv", name: "Boryspil Airport", country: "UA" },
  { iata: "OTP", city: "Bucharest", name: "Henri Coandă Airport", country: "RO" },
  { iata: "SOF", city: "Sofia", name: "Sofia Airport", country: "BG" },
  
  // Balkans
  { iata: "BEG", city: "Belgrade", name: "Belgrade Airport", country: "RS" },
  { iata: "ZAG", city: "Zagreb", name: "Zagreb Airport", country: "HR" },
  { iata: "DBV", city: "Dubrovnik", name: "Dubrovnik Airport", country: "HR" },
  { iata: "SPU", city: "Split", name: "Split Airport", country: "HR" },
  { iata: "LJU", city: "Ljubljana", name: "Ljubljana Airport", country: "SI" },
  { iata: "TIA", city: "Tirana", name: "Tirana Airport", country: "AL" },
  { iata: "SKP", city: "Skopje", name: "Skopje Airport", country: "MK" },
  { iata: "PRN", city: "Pristina", name: "Pristina Airport", country: "XK" },
  { iata: "SJJ", city: "Sarajevo", name: "Sarajevo Airport", country: "BA" },
  { iata: "TGD", city: "Podgorica", name: "Podgorica Airport", country: "ME" },
  
  // North America
  { iata: "JFK", city: "New York", name: "John F. Kennedy Airport", country: "US" },
  { iata: "EWR", city: "Newark", name: "Newark Airport", country: "US" },
  { iata: "LGA", city: "New York", name: "LaGuardia Airport", country: "US" },
  { iata: "ORD", city: "Chicago", name: "O'Hare Airport", country: "US" },
  { iata: "LAX", city: "Los Angeles", name: "Los Angeles Airport", country: "US" },
  { iata: "MIA", city: "Miami", name: "Miami Airport", country: "US" },
  { iata: "SFO", city: "San Francisco", name: "San Francisco Airport", country: "US" },
  { iata: "YYZ", city: "Toronto", name: "Toronto Pearson Airport", country: "CA" },
  { iata: "YUL", city: "Montreal", name: "Montreal Airport", country: "CA" },
  { iata: "YVR", city: "Vancouver", name: "Vancouver Airport", country: "CA" },
  
  // Asia
  { iata: "HKG", city: "Hong Kong", name: "Hong Kong Airport", country: "HK" },
  { iata: "SIN", city: "Singapore", name: "Singapore Changi Airport", country: "SG" },
  { iata: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport", country: "TH" },
  { iata: "NRT", city: "Tokyo", name: "Narita Airport", country: "JP" },
  { iata: "HND", city: "Tokyo", name: "Haneda Airport", country: "JP" },
  { iata: "ICN", city: "Seoul", name: "Incheon Airport", country: "KR" },
  { iata: "PEK", city: "Beijing", name: "Beijing Capital Airport", country: "CN" },
  { iata: "PVG", city: "Shanghai", name: "Shanghai Pudong Airport", country: "CN" },
  { iata: "DEL", city: "New Delhi", name: "Indira Gandhi Airport", country: "IN" },
  { iata: "BOM", city: "Mumbai", name: "Mumbai Airport", country: "IN" },
  
  // Africa
  { iata: "JNB", city: "Johannesburg", name: "O.R. Tambo Airport", country: "ZA" },
  { iata: "CPT", city: "Cape Town", name: "Cape Town Airport", country: "ZA" },
  { iata: "ADD", city: "Addis Ababa", name: "Addis Ababa Bole Airport", country: "ET" },
  { iata: "NBO", city: "Nairobi", name: "Jomo Kenyatta Airport", country: "KE" },
  { iata: "CMN", city: "Casablanca", name: "Mohammed V Airport", country: "MA" },
  { iata: "TUN", city: "Tunis", name: "Tunis-Carthage Airport", country: "TN" },
  
  // South America
  { iata: "GRU", city: "São Paulo", name: "São Paulo Airport", country: "BR" },
  { iata: "GIG", city: "Rio de Janeiro", name: "Rio de Janeiro Airport", country: "BR" },
  { iata: "EZE", city: "Buenos Aires", name: "Ezeiza Airport", country: "AR" },
  { iata: "BOG", city: "Bogotá", name: "El Dorado Airport", country: "CO" },
  { iata: "LIM", city: "Lima", name: "Jorge Chávez Airport", country: "PE" },
  
  // Oceania
  { iata: "SYD", city: "Sydney", name: "Sydney Airport", country: "AU" },
  { iata: "MEL", city: "Melbourne", name: "Melbourne Airport", country: "AU" },
  { iata: "BNE", city: "Brisbane", name: "Brisbane Airport", country: "AU" },
  { iata: "AKL", city: "Auckland", name: "Auckland Airport", country: "NZ" },
];

interface AirportComboboxProps {
  value: string;
  onSelect: (iata: string, city?: string) => void;
  placeholder?: string;
}

export function AirportCombobox({ value, onSelect, placeholder = "Vyberte letiště..." }: AirportComboboxProps) {
  const [open, setOpen] = useState(false);
  const [manualInput, setManualInput] = useState(false);

  const selectedAirport = airports.find((airport) => airport.iata === value);

  if (manualInput) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onSelect(e.target.value.toUpperCase())}
          placeholder="IATA kód (např. PRG)"
          maxLength={3}
          className="uppercase"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setManualInput(false)}
          size="sm"
        >
          Seznam
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedAirport
              ? `${selectedAirport.iata} - ${selectedAirport.city}`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 bg-popover z-50">
          <Command>
            <CommandInput placeholder="Hledat letiště..." />
            <CommandList>
              <CommandEmpty>Žádné letiště nenalezeno.</CommandEmpty>
              <CommandGroup>
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.iata}
                    value={`${airport.iata} ${airport.city} ${airport.name} ${airport.country}`}
                    onSelect={() => {
                      onSelect(airport.iata, airport.city);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === airport.iata ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold">{airport.iata} - {airport.city}</span>
                      <span className="text-xs text-muted-foreground">{airport.name}, {airport.country}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        onClick={() => setManualInput(true)}
        size="sm"
        title="Zadat IATA kód ručně"
      >
        Ručně
      </Button>
    </div>
  );
}
