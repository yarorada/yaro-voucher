import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Airport {
  iata: string;
  city: string;
  name: string;
  country: string;
}

interface AirportComboboxProps {
  value: string;
  onSelect: (iata: string, city?: string) => void;
  placeholder?: string;
}

export function AirportCombobox({ value, onSelect, placeholder = "Vyberte letiště..." }: AirportComboboxProps) {
  const [open, setOpen] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIata, setNewIata] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);

  // Fetch selected airport on mount if value exists
  useEffect(() => {
    if (value && !selectedAirport) {
      fetchSelectedAirport(value);
    }
  }, [value]);

  const fetchSelectedAirport = async (iata: string) => {
    try {
      const { data, error } = await supabase
        .from('airport_templates')
        .select('iata, city, name, country')
        .eq('iata', iata)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedAirport(data);
      }
    } catch (error) {
      console.error('Error fetching selected airport:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || open) {
        fetchAirports(searchQuery);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  const fetchAirports = async (query: string = "") => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('airport_templates')
        .select('iata, city, name, country')
        .order('city');

      // Server-side filtering - search in iata, city, name, or country
      if (query.length >= 2) {
        queryBuilder = queryBuilder.or(
          `iata.ilike.%${query}%,city.ilike.%${query}%,name.ilike.%${query}%,country.ilike.%${query}%`
        );
      } else {
        // Only load first 50 when no search query
        queryBuilder = queryBuilder.limit(50);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      setAirports(data || []);
    } catch (error) {
      console.error('Error fetching airports:', error);
      toast.error("Nepodařilo se načíst letiště");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = async () => {
    if (!newIata.trim() || !newCity.trim() || !newName.trim() || !newCountry.trim()) {
      toast.error("Vyplňte všechna pole");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('airport_templates')
        .insert({
          iata: newIata.toUpperCase().trim(),
          city: newCity.trim(),
          name: newName.trim(),
          country: newCountry.toUpperCase().trim(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Letiště přidáno");
      setSelectedAirport(data);
      onSelect(data.iata, data.city);
      setDialogOpen(false);
      setNewIata("");
      setNewCity("");
      setNewName("");
      setNewCountry("");
      setOpen(false);
    } catch (error: any) {
      console.error('Error adding airport:', error);
      if (error.code === '23505') {
        toast.error("Letiště s tímto IATA kódem již existuje");
      } else {
        toast.error("Nepodařilo se přidat letiště");
      }
    }
  };

  const handleSelect = (airport: Airport) => {
    setSelectedAirport(airport);
    onSelect(airport.iata, airport.city);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSearchQuery("");
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            onKeyDown={(e) => {
              if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                setOpen(true);
              }
            }}
          >
            {selectedAirport
              ? `${selectedAirport.iata} - ${selectedAirport.city}`
              : value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 bg-popover z-50">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Hledat letiště (min. 2 znaky)..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Načítám...
                </div>
              ) : airports.length === 0 ? (
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      {searchQuery.length < 2 
                        ? "Zadejte alespoň 2 znaky pro vyhledávání"
                        : "Žádné letiště nenalezeno."}
                    </p>
                    {searchQuery.length >= 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDialogOpen(true);
                          setOpen(false);
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Přidat nové
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
              ) : (
                <>
                  <CommandGroup>
                    {airports.map((airport) => (
                      <CommandItem
                        key={airport.iata}
                        value={airport.iata}
                        onSelect={() => handleSelect(airport)}
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
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setDialogOpen(true);
                        setOpen(false);
                      }}
                      className="justify-center text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Přidat nové letiště
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat letiště</DialogTitle>
            <DialogDescription>
              Přidejte nové letiště do databáze
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="iata">IATA kód (3 znaky) *</Label>
              <Input
                id="iata"
                value={newIata}
                onChange={(e) => setNewIata(e.target.value.toUpperCase())}
                placeholder="např. PRG"
                maxLength={3}
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="city">Město *</Label>
              <Input
                id="city"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="např. Praha"
              />
            </div>
            <div>
              <Label htmlFor="name">Název letiště *</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="např. Václav Havel Airport Prague"
              />
            </div>
            <div>
              <Label htmlFor="country">Kód země (3 znaky) *</Label>
              <Input
                id="country"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                placeholder="např. CZE"
                maxLength={3}
                className="uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewIata("");
                setNewCity("");
                setNewName("");
                setNewCountry("");
              }}
            >
              Zrušit
            </Button>
            <Button onClick={handleAddNew}>Přidat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
