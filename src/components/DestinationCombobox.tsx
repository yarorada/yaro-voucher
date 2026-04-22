import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn, removeDiacritics } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { searchCountries, searchDestinations } from "@/lib/countryData";

interface Destination {
  id: string;
  name: string;
  countries: { id: string; name: string; iso_code: string } | null;
}

interface DestinationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DestinationCombobox({ value, onValueChange }: DestinationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [customCountrySearch, setCustomCountrySearch] = useState("");
  const [showCustomCountryPicker, setShowCustomCountryPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDestinations();
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
      setShowCustomCountryPicker(false);
      setCustomCountrySearch("");
    }
  }, [open]);

  const fetchDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from("destinations")
        .select(`id, name, countries:country_id (id, name, iso_code)`)
        .order("name");
      if (error) throw error;
      setDestinations(data || []);
    } catch (error) {
      console.error("Error fetching destinations:", error);
    } finally {
      setLoading(false);
    }
  };

  const q = removeDiacritics(search.trim().toLowerCase());

  // Filter existing destinations
  const filteredDestinations = useMemo(() => {
    if (q.length < 1) return destinations;
    return destinations.filter(
      (d) =>
        removeDiacritics(d.name.toLowerCase()).includes(q) ||
        removeDiacritics(d.countries?.name.toLowerCase() || "").includes(q) ||
        removeDiacritics(d.countries?.iso_code.toLowerCase() || "").includes(q)
    );
  }, [destinations, q]);

  // Suggest known destinations from DESTINATION_COUNTRY_MAP when ≥3 chars
  const destinationSuggestions = useMemo(() => {
    if (q.length < 3) return [];
    // Don't suggest if there's an exact existing destination match
    const hasExact = destinations.some((d) => removeDiacritics(d.name.toLowerCase()) === q);
    if (hasExact) return [];
    return searchDestinations(search, 8);
  }, [search, q, destinations]);

  // Suggest countries (fallback when no destination match found)
  const countrySuggestions = useMemo(() => {
    if (q.length < 3) return [];
    if (destinationSuggestions.length > 0) return []; // prefer destination suggestions
    const hasExact = destinations.some((d) => removeDiacritics(d.name.toLowerCase()) === q);
    if (hasExact) return [];
    return searchCountries(search, 8);
  }, [search, q, destinations, destinationSuggestions]);

  const selectedDestination = destinations.find((d) => d.id === value);
  const selectedDestinationLabel = selectedDestination
    ? `${selectedDestination.name} (${selectedDestination.countries?.name} – ${selectedDestination.countries?.iso_code})`
    : "Vyberte destinaci...";

  // Create destination + country (if needed) in one flow
  const handleCreateNew = async (destinationName: string, countryName: string, iso: string, currency: string) => {
    setSaving(true);
    try {
      // Check if country already exists by ISO code
      let countryId: string;
      const { data: existingCountry } = await supabase
        .from("countries")
        .select("id")
        .eq("iso_code", iso)
        .maybeSingle();

      if (existingCountry) {
        countryId = existingCountry.id;
      } else {
        // Create the country
        const { data: newCountry, error: countryError } = await supabase
          .from("countries")
          .insert({ name: countryName, iso_code: iso, currency })
          .select("id")
          .single();
        if (countryError) throw countryError;
        countryId = newCountry.id;
        toast.success(`Země ${countryName} (${iso}) přidána`);
      }

      // Create the destination
      const { data: newDest, error: destError } = await supabase
        .from("destinations")
        .insert({ name: destinationName, country_id: countryId })
        .select(`id, name, countries:country_id (id, name, iso_code)`)
        .single();
      if (destError) throw destError;

      toast.success(`Destinace "${destinationName}" přidána`);
      setDestinations((prev) => [...prev, newDest]);
      onValueChange(newDest.id);
      setOpen(false);
      setSearch("");
    } catch (error: any) {
      console.error("Error creating destination:", error);
      toast.error("Nepodařilo se vytvořit destinaci");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-0 justify-between overflow-hidden"
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedDestinationLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] min-w-0 p-0 bg-popover z-50" align="start" onWheel={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b px-3">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat nebo zadat novou destinaci..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {loading && (
            <div className="py-4 text-center text-sm text-muted-foreground">Načítání...</div>
          )}

          {/* Existing destinations */}
          {filteredDestinations.length > 0 && (
            <div>
              {filteredDestinations.map((destination) => (
                <button
                  key={destination.id}
                  onClick={() => {
                    onValueChange(destination.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "relative flex w-full min-w-0 cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === destination.id && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === destination.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 truncate text-left">
                    {destination.name} ({destination.countries?.name} – {destination.countries?.iso_code})
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Separator if we have both */}
          {filteredDestinations.length > 0 && (destinationSuggestions.length > 0 || countrySuggestions.length > 0) && (
            <div className="my-1 h-px bg-border" />
          )}

          {/* Smart destination suggestions (e.g. Hurghada → Egypt) */}
          {destinationSuggestions.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Vytvořit novou destinaci
              </div>
              {destinationSuggestions.map((sug) => (
                <button
                  key={`${sug.destination}-${sug.iso}`}
                  disabled={saving}
                  onClick={() => {
                    handleCreateNew(sug.destination, sug.countryName, sug.iso, sug.currency);
                  }}
                  className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-left">
                    {sug.destination} – {sug.countryName} ({sug.iso})
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Fallback: country suggestions for creating new destinations */}
          {countrySuggestions.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Vytvořit novou destinaci
              </div>
              {countrySuggestions.map((country) => (
                <button
                  key={country.iso}
                  disabled={saving}
                  onClick={() => {
                    const destName = search.trim().charAt(0).toUpperCase() + search.trim().slice(1);
                    handleCreateNew(destName, country.name, country.iso, country.currency);
                  }}
                  className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-left">
                    {search.trim()} → {country.name} ({country.iso}) · {country.currency}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && filteredDestinations.length === 0 && destinationSuggestions.length === 0 && countrySuggestions.length === 0 && q.length >= 3 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Žádná shoda – vytvořit vlastní destinaci
              </div>
              {!showCustomCountryPicker ? (
                <button
                  onClick={() => setShowCustomCountryPicker(true)}
                  className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-left">
                    Vytvořit <strong>„{search.trim()}"</strong> a přiřadit zemi
                  </span>
                </button>
              ) : (
                <div className="space-y-2 px-2 py-1">
                  <Input
                    value={customCountrySearch}
                    onChange={(e) => setCustomCountrySearch(e.target.value)}
                    placeholder="Zadejte název země..."
                    className="h-8 text-sm"
                    autoFocus
                  />
                  {customCountrySearch.trim().length >= 2 && (
                    <div className="max-h-[150px] overflow-y-auto rounded border">
                      {searchCountries(customCountrySearch, 10).map((country) => (
                        <button
                          key={country.iso}
                          disabled={saving}
                          onClick={() => {
                            const destName = search.trim().charAt(0).toUpperCase() + search.trim().slice(1);
                            handleCreateNew(destName, country.name, country.iso, country.currency);
                            setShowCustomCountryPicker(false);
                            setCustomCountrySearch("");
                          }}
                          className="flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3 shrink-0 text-primary" />
                          <span className="min-w-0 truncate text-left">{country.name} ({country.iso})</span>
                        </button>
                      ))}
                      {searchCountries(customCountrySearch, 10).length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">Země nenalezena</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && q.length > 0 && q.length < 3 && filteredDestinations.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Zadejte alespoň 3 znaky pro vyhledání...
            </div>
          )}

          {saving && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vytvářím...
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
