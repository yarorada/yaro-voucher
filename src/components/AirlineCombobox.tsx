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

interface Airline {
  code: string;
  name: string;
}

const airlines: Airline[] = [
  { code: "OK", name: "Czech Airlines" },
  { code: "QS", name: "Smartwings" },
  { code: "FR", name: "Ryanair" },
  { code: "W6", name: "Wizz Air" },
  { code: "U2", name: "easyJet" },
  { code: "LH", name: "Lufthansa" },
  { code: "OS", name: "Austrian Airlines" },
  { code: "BA", name: "British Airways" },
  { code: "AF", name: "Air France" },
  { code: "KL", name: "KLM" },
  { code: "LX", name: "Swiss International Air Lines" },
  { code: "SN", name: "Brussels Airlines" },
  { code: "AZ", name: "ITA Airways" },
  { code: "IB", name: "Iberia" },
  { code: "TP", name: "TAP Air Portugal" },
  { code: "SK", name: "SAS" },
  { code: "AY", name: "Finnair" },
  { code: "LO", name: "LOT Polish Airlines" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "PC", name: "Pegasus Airlines" },
  { code: "XQ", name: "SunExpress" },
  { code: "A3", name: "Aegean Airlines" },
  { code: "EK", name: "Emirates" },
  { code: "QR", name: "Qatar Airways" },
  { code: "EY", name: "Etihad Airways" },
  { code: "MS", name: "EgyptAir" },
  { code: "SU", name: "Aeroflot" },
  { code: "PS", name: "Ukraine International Airlines" },
  { code: "RO", name: "Tarom" },
  { code: "FB", name: "Bulgaria Air" },
  { code: "JU", name: "Air Serbia" },
  { code: "OU", name: "Croatia Airlines" },
  { code: "JP", name: "Adria Airways" },
  { code: "AA", name: "American Airlines" },
  { code: "DL", name: "Delta Air Lines" },
  { code: "UA", name: "United Airlines" },
  { code: "AC", name: "Air Canada" },
  { code: "SQ", name: "Singapore Airlines" },
  { code: "CX", name: "Cathay Pacific" },
  { code: "TG", name: "Thai Airways" },
  { code: "NH", name: "All Nippon Airways" },
  { code: "JL", name: "Japan Airlines" },
  { code: "KE", name: "Korean Air" },
  { code: "CA", name: "Air China" },
  { code: "MU", name: "China Eastern Airlines" },
  { code: "AI", name: "Air India" },
  { code: "SA", name: "South African Airways" },
  { code: "LA", name: "LATAM Airlines" },
  { code: "QF", name: "Qantas" },
];

interface AirlineComboboxProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
}

export function AirlineCombobox({ value, onSelect, placeholder = "Kód dopravce..." }: AirlineComboboxProps) {
  const [open, setOpen] = useState(false);
  const [manualInput, setManualInput] = useState(false);

  const selectedAirline = airlines.find((airline) => airline.code === value);

  if (manualInput) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onSelect(e.target.value.toUpperCase(), "")}
          placeholder="IATA kód (např. OK)"
          maxLength={2}
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
            {selectedAirline
              ? `${selectedAirline.code} - ${selectedAirline.name}`
              : value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 bg-popover z-50">
          <Command>
            <CommandInput placeholder="Hledat leteckou společnost..." />
            <CommandList>
              <CommandEmpty>Žádná letecká společnost nenalezena.</CommandEmpty>
              <CommandGroup>
                {airlines.map((airline) => (
                  <CommandItem
                    key={airline.code}
                    value={`${airline.code} ${airline.name}`}
                    onSelect={() => {
                      onSelect(airline.code, airline.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === airline.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold">{airline.code} - {airline.name}</span>
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
