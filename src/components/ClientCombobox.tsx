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

interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClientComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export function ClientCombobox({ value, onChange }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientFirstName.trim() || !newClientLastName.trim()) {
      toast.error("Vyplňte jméno a příjmení klienta");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          first_name: newClientFirstName.trim(),
          last_name: newClientLastName.trim(),
          email: newClientEmail.trim() || null,
          phone: newClientPhone.trim() || null,
          address: newClientAddress.trim() || null,
          notes: newClientNotes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setClients([...clients, data]);
      onChange(data.id);
      setDialogOpen(false);
      setNewClientFirstName("");
      setNewClientLastName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientAddress("");
      setNewClientNotes("");
      toast.success("Klient vytvořen");
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Nepodařilo se vytvořit klienta");
    } finally {
      setCreating(false);
    }
  };

  const selectedClient = clients.find((client) => client.id === value);
  
  const hasNoMatch = searchValue && !clients.some(c => 
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchValue.toLowerCase())
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
            {selectedClient
              ? `${selectedClient.first_name} ${selectedClient.last_name}`
              : "Vyberte klienta..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background z-50" align="start">
          <Command className="bg-background" shouldFilter={false}>
            <CommandInput 
              placeholder="Hledat klienta..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? "Načítám..." : "Žádný klient nenalezen."}
              </CommandEmpty>
              <CommandGroup>
                {clients
                  .filter(client => 
                    `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchValue.toLowerCase())
                  )
                  .map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`${client.first_name} ${client.last_name}`}
                      onSelect={() => {
                        onChange(client.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === client.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {client.first_name} {client.last_name}
                    </CommandItem>
                  ))}
                {hasNoMatch && searchValue.trim() && (
                  <CommandItem
                    value={`create-${searchValue}`}
                    onSelect={() => {
                      const parts = searchValue.trim().split(/\s+/);
                      if (parts.length >= 2) {
                        setNewClientFirstName(parts[0]);
                        setNewClientLastName(parts.slice(1).join(' '));
                      } else {
                        setNewClientFirstName(searchValue.trim());
                        setNewClientLastName("");
                      }
                      setDialogOpen(true);
                      setOpen(false);
                    }}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvořit nového klienta: "{searchValue}"
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
            <DialogTitle>Vytvořit nového klienta</DialogTitle>
            <DialogDescription>
              Vyplňte informace o novém klientovi
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Jméno *</Label>
                <Input
                  id="firstName"
                  value={newClientFirstName}
                  onChange={(e) => setNewClientFirstName(e.target.value)}
                  placeholder="např. Jan"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Příjmení *</Label>
                <Input
                  id="lastName"
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  placeholder="např. Novák"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="např. jan.novak@email.cz"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="např. +420 123 456 789"
              />
            </div>
            <div>
              <Label htmlFor="address">Adresa</Label>
              <Input
                id="address"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                placeholder="např. Hlavní 123, Praha"
              />
            </div>
            <div>
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea
                id="notes"
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
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
                onClick={handleCreateClient}
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
