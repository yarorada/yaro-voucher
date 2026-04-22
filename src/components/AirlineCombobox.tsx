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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Airline {
  code: string;
  name: string;
}

interface AirlineComboboxProps {
  value: string;
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
}

export function AirlineCombobox({ value, onSelect, placeholder = "Kód dopravce..." }: AirlineComboboxProps) {
  const [open, setOpen] = useState(false);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [_loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchAirlines();
  }, []);

  const fetchAirlines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('airline_templates')
        .select('code, name')
        .order('code');

      if (error) throw error;
      setAirlines(data || []);
    } catch (error) {
      console.error('Error fetching airlines:', error);
      toast.error("Nepodařilo se načíst letecké společnosti");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = async () => {
    if (!newCode.trim() || !newName.trim()) {
      toast.error("Vyplňte kód a název letecké společnosti");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('airline_templates')
        .insert({
          code: newCode.toUpperCase().trim(),
          name: newName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Letecká společnost přidána");
      setAirlines([...airlines, { code: data.code, name: data.name }]);
      onSelect(data.code, data.name);
      setDialogOpen(false);
      setNewCode("");
      setNewName("");
      setOpen(false);
    } catch (error: any) {
      console.error('Error adding airline:', error);
      if (error.code === '23505') {
        toast.error("Letecká společnost s tímto kódem již existuje");
      } else {
        toast.error("Nepodařilo se přidat leteckou společnost");
      }
    }
  };

  const selectedAirline = airlines.find((airline) => airline.code === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
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
              <CommandEmpty>
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Žádná letecká společnost nenalezena.
                  </p>
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
                </div>
              </CommandEmpty>
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
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setDialogOpen(true);
                    setOpen(false);
                  }}
                  className="justify-center text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat novou leteckou společnost
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat leteckou společnost</DialogTitle>
            <DialogDescription>
              Přidejte novou leteckou společnost do databáze
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">IATA kód (2 znaky) *</Label>
              <Input
                id="code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="např. OK"
                maxLength={2}
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="name">Název letecké společnosti *</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="např. Czech Airlines"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewCode("");
                setNewName("");
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
