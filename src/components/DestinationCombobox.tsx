import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface Destination {
  id: string;
  name: string;
  countries: { name: string } | null;
}

interface DestinationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DestinationCombobox({ value, onValueChange }: DestinationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from("destinations")
        .select(`
          id,
          name,
          countries:country_id (name)
        `)
        .order("name");

      if (error) throw error;
      setDestinations(data || []);
    } catch (error) {
      console.error("Error fetching destinations:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedDestination = destinations.find((d) => d.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedDestination
            ? `${selectedDestination.name} (${selectedDestination.countries?.name})`
            : "Vyberte destinaci..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Hledat destinaci..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Načítání..." : "Žádná destinace nenalezena."}
            </CommandEmpty>
            <CommandGroup>
              {destinations.map((destination) => (
                <CommandItem
                  key={destination.id}
                  value={`${destination.name} ${destination.countries?.name}`}
                  onSelect={() => {
                    onValueChange(destination.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === destination.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {destination.name} ({destination.countries?.name})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
