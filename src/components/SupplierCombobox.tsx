import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn, removeDiacritics } from "@/lib/utils";
import { formatPhone } from "@/lib/phoneFormat";
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
  onSelect?: (supplierId: string) => void;
}

const emptyNew = {
  name: "",
  contact: "",
  email: "",
  phone: "",
  street: "",
  postal_code: "",
  city: "",
  country_name: "",
  website: "",
  notes: "",
};

export function SupplierCombobox({ value, onChange, onSelect }: SupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState(emptyNew);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      setSuppliers(data || []);
    } catch {
      console.error("Error fetching suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    if (newSupplier.phone.trim()) {
      setNewSupplier((s) => ({ ...s, phone: formatPhone(s.phone) }));
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name.trim()) { toast.error("Vyplňte název dodavatele"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: newSupplier.name.trim(),
          contact_person: newSupplier.contact.trim() || null,
          email: newSupplier.email.trim() || null,
          phone: newSupplier.phone.trim() ? formatPhone(newSupplier.phone.trim()) : null,
          street: newSupplier.street.trim() || null,
          postal_code: newSupplier.postal_code.trim() || null,
          city: newSupplier.city.trim() || null,
          country_name: newSupplier.country_name.trim() || null,
          website: newSupplier.website.trim() || null,
          notes: newSupplier.notes.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      setSuppliers((prev) => [...prev, data]);
      onChange(data.id);
      if (onSelect) onSelect(data.id);
      setDialogOpen(false);
      setNewSupplier(emptyNew);
      toast.success("Dodavatel vytvořen");
    } catch {
      toast.error("Nepodařilo se vytvořit dodavatele");
    } finally {
      setCreating(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === value);
  const hasNoMatch = searchValue && !suppliers.some(s =>
    removeDiacritics(s.name.toLowerCase()).includes(removeDiacritics(searchValue.toLowerCase()))
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
        <PopoverContent className="w-[300px] p-0 bg-popover z-[9999]" align="start" style={{ pointerEvents: "auto" }}>
          <Command className="bg-popover" shouldFilter={false}>
            <CommandInput placeholder="Hledat dodavatele..." value={searchValue} onValueChange={setSearchValue} />
            <CommandList className="max-h-[250px] overflow-y-auto bg-popover" onWheel={(e) => e.stopPropagation()}>
              <CommandEmpty>{loading ? "Načítám..." : "Žádný dodavatel nenalezen."}</CommandEmpty>
              <CommandGroup>
                {suppliers
                  .filter((s) => removeDiacritics(s.name.toLowerCase()).includes(removeDiacritics(searchValue.toLowerCase())))
                  .map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      value={supplier.name}
                      onSelect={() => {
                        onChange(supplier.id);
                        if (onSelect) onSelect(supplier.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                      className="cursor-pointer"
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === supplier.id ? "opacity-100" : "opacity-0")} />
                      {supplier.name}
                    </CommandItem>
                  ))}
                {hasNoMatch && searchValue.trim() && (
                  <CommandItem
                    value={`create-${searchValue}`}
                    onSelect={() => {
                      setNewSupplier({ ...emptyNew, name: searchValue });
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vytvořit nového dodavatele</DialogTitle>
            <DialogDescription>Vyplňte informace o novém dodavateli</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="sc-name">Název *</Label>
                <Input id="sc-name" value={newSupplier.name} onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))} placeholder="např. Hotel Paradise" />
              </div>
              <div>
                <Label htmlFor="sc-contact">Kontaktní osoba</Label>
                <Input id="sc-contact" value={newSupplier.contact} onChange={(e) => setNewSupplier((s) => ({ ...s, contact: e.target.value }))} placeholder="Jan Novák" />
              </div>
              <div>
                <Label htmlFor="sc-email">Email</Label>
                <Input id="sc-email" type="email" value={newSupplier.email} onChange={(e) => setNewSupplier((s) => ({ ...s, email: e.target.value }))} placeholder="info@hotel.cz" />
              </div>
              <div>
                <Label htmlFor="sc-phone">Telefon</Label>
                <Input
                  id="sc-phone"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, phone: e.target.value }))}
                  onBlur={handlePhoneBlur}
                  placeholder="+420 777 123 456"
                />
              </div>
              <div>
                <Label htmlFor="sc-website">Web</Label>
                <Input id="sc-website" value={newSupplier.website} onChange={(e) => setNewSupplier((s) => ({ ...s, website: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adresa</Label>
              <Input
                value={newSupplier.street}
                onChange={(e) => setNewSupplier((s) => ({ ...s, street: e.target.value }))}
                placeholder="Ulice a č.p."
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={newSupplier.postal_code}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, postal_code: e.target.value }))}
                  placeholder="PSČ"
                />
                <Input
                  className="col-span-2"
                  value={newSupplier.city}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, city: e.target.value }))}
                  placeholder="Město"
                />
              </div>
              <Input
                value={newSupplier.country_name}
                onChange={(e) => setNewSupplier((s) => ({ ...s, country_name: e.target.value }))}
                placeholder="Stát"
              />
            </div>

            <div>
              <Label htmlFor="sc-notes">Poznámky</Label>
              <Textarea id="sc-notes" value={newSupplier.notes} onChange={(e) => setNewSupplier((s) => ({ ...s, notes: e.target.value }))} rows={3} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>Zrušit</Button>
              <Button onClick={handleCreateSupplier} disabled={creating}>
                {creating ? "Vytvářím..." : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
