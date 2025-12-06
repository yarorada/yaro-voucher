import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Destination {
  id: string;
  name: string;
  countries: { name: string } | null;
}

interface Country {
  id: string;
  name: string;
  iso_code: string;
}

interface DestinationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DestinationCombobox({ value, onValueChange }: DestinationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCountryId, setNewCountryId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDestinations();
    fetchCountries();
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

  const fetchCountries = async () => {
    try {
      const { data, error } = await supabase
        .from("countries")
        .select("id, name, iso_code")
        .order("name");

      if (error) throw error;
      setCountries(data || []);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim() || !newCountryId) {
      toast.error("Vyplňte název destinace a vyberte zemi");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("destinations")
        .insert({
          name: newName.trim(),
          country_id: newCountryId,
          description: newDescription.trim() || null,
        })
        .select(`
          id,
          name,
          countries:country_id (name)
        `)
        .single();

      if (error) throw error;

      toast.success("Destinace přidána");
      setDestinations([...destinations, data]);
      onValueChange(data.id);
      setDialogOpen(false);
      setNewName("");
      setNewCountryId("");
      setNewDescription("");
      setOpen(false);
    } catch (error: any) {
      console.error("Error adding destination:", error);
      toast.error("Nepodařilo se přidat destinaci");
    } finally {
      setSaving(false);
    }
  };

  const selectedDestination = destinations.find((d) => d.id === value);

  return (
    <>
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
        <PopoverContent className="w-full p-0 bg-popover z-50">
          <Command>
            <CommandInput placeholder="Hledat destinaci..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    {loading ? "Načítání..." : "Žádná destinace nenalezena."}
                  </p>
                  {!loading && (
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
                      Přidat novou
                    </Button>
                  )}
                </div>
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
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setDialogOpen(true);
                    setOpen(false);
                  }}
                  className="justify-center text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat novou destinaci
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat destinaci</DialogTitle>
            <DialogDescription>
              Přidejte novou destinaci do databáze
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="destName">Název destinace *</Label>
              <Input
                id="destName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="např. Costa del Sol"
              />
            </div>
            <div>
              <Label htmlFor="destCountry">Země *</Label>
              <Select value={newCountryId} onValueChange={setNewCountryId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Vyberte zemi..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name} ({country.iso_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="destDescription">Popis (volitelné)</Label>
              <Input
                id="destDescription"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Krátký popis destinace..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewName("");
                setNewCountryId("");
                setNewDescription("");
              }}
            >
              Zrušit
            </Button>
            <Button onClick={handleAddNew} disabled={saving}>
              {saving ? "Ukládám..." : "Přidat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
