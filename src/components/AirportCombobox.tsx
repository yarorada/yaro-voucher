import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
}

const airports: Airport[] = [
  { iata: "PRG", city: "Praha", name: "Václav Havel Airport Prague" },
  { iata: "IST", city: "Istanbul", name: "Istanbul Airport" },
  { iata: "AYT", city: "Antalya", name: "Antalya Airport" },
  { iata: "DLM", city: "Dalaman", name: "Dalaman Airport" },
  { iata: "BJV", city: "Bodrum", name: "Bodrum-Milas Airport" },
  { iata: "SAW", city: "Istanbul", name: "Sabiha Gökçen Airport" },
  { iata: "ESB", city: "Ankara", name: "Esenboğa Airport" },
  { iata: "ADB", city: "Izmir", name: "Adnan Menderes Airport" },
  { iata: "LCA", city: "Larnaca", name: "Larnaca Airport" },
  { iata: "PFO", city: "Paphos", name: "Paphos Airport" },
  { iata: "ATH", city: "Athens", name: "Athens International Airport" },
  { iata: "HER", city: "Heraklion", name: "Heraklion Airport" },
  { iata: "RHO", city: "Rhodes", name: "Rhodes Airport" },
  { iata: "DXB", city: "Dubai", name: "Dubai International Airport" },
  { iata: "AUH", city: "Abu Dhabi", name: "Abu Dhabi International Airport" },
  { iata: "BEY", city: "Beirut", name: "Beirut-Rafic Hariri Airport" },
  { iata: "CAI", city: "Cairo", name: "Cairo International Airport" },
  { iata: "SSH", city: "Sharm El Sheikh", name: "Sharm El Sheikh Airport" },
  { iata: "HRG", city: "Hurghada", name: "Hurghada Airport" },
  { iata: "TLV", city: "Tel Aviv", name: "Ben Gurion Airport" },
  { iata: "VIE", city: "Vienna", name: "Vienna International Airport" },
  { iata: "MUC", city: "Munich", name: "Munich Airport" },
  { iata: "FRA", city: "Frankfurt", name: "Frankfurt Airport" },
  { iata: "CDG", city: "Paris", name: "Charles de Gaulle Airport" },
  { iata: "LHR", city: "London", name: "London Heathrow Airport" },
  { iata: "FCO", city: "Rome", name: "Fiumicino Airport" },
  { iata: "BCN", city: "Barcelona", name: "Barcelona-El Prat Airport" },
  { iata: "MAD", city: "Madrid", name: "Madrid-Barajas Airport" },
];

interface AirportComboboxProps {
  value: string;
  onSelect: (iata: string) => void;
  placeholder?: string;
}

export function AirportCombobox({ value, onSelect, placeholder = "Vyberte letiště..." }: AirportComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedAirport = airports.find((airport) => airport.iata === value);

  return (
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
      <PopoverContent className="w-[300px] p-0 bg-popover z-50">
        <Command>
          <CommandInput placeholder="Hledat letiště..." />
          <CommandList>
            <CommandEmpty>Žádné letiště nenalezeno.</CommandEmpty>
            <CommandGroup>
              {airports.map((airport) => (
                <CommandItem
                  key={airport.iata}
                  value={`${airport.iata} ${airport.city} ${airport.name}`}
                  onSelect={() => {
                    onSelect(airport.iata);
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
                    <span className="text-xs text-muted-foreground">{airport.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
