import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
}

interface SupplierComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SupplierCombobox({ value, onChange }: SupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [newSupplierNotes, setNewSupplierNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Vyplňte název dodavatele");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: newSupplierName.trim(),
          contact_person: newSupplierContact.trim() || null,
          email: newSupplierEmail.trim() || null,
          phone: newSupplierPhone.trim() || null,
          address: newSupplierAddress.trim() || null,
          notes: newSupplierNotes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setSuppliers([...suppliers, data]);
      onChange(data.id);
      setDialogOpen(false);
      setNewSupplierName("");
      setNewSupplierContact("");
      setNewSupplierEmail("");
      setNewSupplierPhone("");
      setNewSupplierAddress("");
      setNewSupplierNotes("");
      toast.success("Dodavatel vytvořen");
    } catch (error) {
      console.error("Error creating supplier:", error);
      toast.error("Nepodařilo se vytvořit dodavatele");
    } finally {
      setCreating(false);
    }
  };

  const selectedSupplier = suppliers.find((supplier) => supplier.id === value);
  
  const hasNoMatch = searchValue && !suppliers.some(s => 
    s.name.toLowerCase().includes(searchValue.toLowerCase())
  );

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
                setSearchValue(e.key);
              }
            }}
          >
            {selectedSupplier ? selectedSupplier.name : "Vyberte dodavatele..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background z-50" align="start">
          <Command className="bg-background" shouldFilter={false}>
            <CommandInput 
              placeholder="Hledar dodavatele..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? "Načítám..." : "Žádný dodavatel nenalezen."}
              </CommandEmpty>
              <CommandGroup>
                {suppliers
                  .filter(supplier => 
                    supplier.name.toLowerCase().includes(searchValue.toLowerCase())
                  )
                  .map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      value={supplier.name}
                      onSelect={() => {
                        onChange(supplier.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === supplier.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {supplier.name}
                    </CommandItem>
                  ))}
                {hasNoMatch && searchValue.trim() && (
                  <CommandItem
                    value={`create-${searchValue}`}
                    onSelect={() => {
                      setNewSupplierName(searchValue);
                      setDialogOpen(true);
                      setOpen(false);
                    }}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvořit nového dodavatele: "{searchValue}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vytvořit nového dodavatele</DialogTitle>
            <DialogDescription>
              Vyplňte informace o novém dodavateli
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Název *</Label>
              <Input
                id="name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="např. Hotel Paradise"
              />
            </div>
            <div>
              <Label htmlFor="contact">Kontaktní osoba</Label>
              <Input
                id="contact"
                value={newSupplierContact}
                onChange={(e) => setNewSupplierContact(e.target.value)}
                placeholder="např. Jan Novák"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                placeholder="např. info@hotel.cz"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="např. +420 123 456 789"
              />
            </div>
            <div>
              <Label htmlFor="address">Adresa</Label>
              <Input
                id="address"
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                placeholder="např. Hlavní 123, Praha"
              />
            </div>
            <div>
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea
                id="notes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Další informace..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Zrušit
              </Button>
              <Button
                onClick={handleCreateSupplier}
                disabled={creating}
              >
                {creating ? "Vytvářím..." : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
