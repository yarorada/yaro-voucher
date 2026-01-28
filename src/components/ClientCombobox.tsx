import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Contact } from "lucide-react";
import { cn, removeDiacritics } from "@/lib/utils";
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
import { DateInput } from "@/components/ui/date-input";
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
  const [newClientPassportNumber, setNewClientPassportNumber] = useState("");
  const [newClientPassportExpiry, setNewClientPassportExpiry] = useState<Date | undefined>(undefined);
  const [newClientIdCardNumber, setNewClientIdCardNumber] = useState("");
  const [newClientIdCardExpiry, setNewClientIdCardExpiry] = useState<Date | undefined>(undefined);
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
      const normalizedFirstName = removeDiacritics(newClientFirstName.trim());
      const normalizedLastName = removeDiacritics(newClientLastName.trim());
      
      // Check for existing client with diacritics normalization
      const existingClient = clients.find(client => 
        removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName.toLowerCase() &&
        removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName.toLowerCase()
      );
      
      if (existingClient) {
        // Use existing client instead of creating duplicate
        onChange(existingClient.id);
        setDialogOpen(false);
        setNewClientFirstName("");
        setNewClientLastName("");
        setNewClientEmail("");
        setNewClientPhone("");
        setNewClientAddress("");
        setNewClientNotes("");
        setNewClientPassportNumber("");
        setNewClientPassportExpiry(undefined);
        setNewClientIdCardNumber("");
        setNewClientIdCardExpiry(undefined);
        toast.info(`Klient ${existingClient.first_name} ${existingClient.last_name} již existuje, byl vybrán`);
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          email: newClientEmail.trim() || null,
          phone: newClientPhone.trim() || null,
          address: newClientAddress.trim() || null,
          notes: newClientNotes.trim() || null,
          passport_number: newClientPassportNumber.trim() || null,
          passport_expiry: newClientPassportExpiry?.toISOString().split('T')[0] || null,
          id_card_number: newClientIdCardNumber.trim() || null,
          id_card_expiry: newClientIdCardExpiry?.toISOString().split('T')[0] || null,
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
      setNewClientPassportNumber("");
      setNewClientPassportExpiry(undefined);
      setNewClientIdCardNumber("");
      setNewClientIdCardExpiry(undefined);
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
    removeDiacritics(`${c.first_name} ${c.last_name}`).toLowerCase().includes(removeDiacritics(searchValue).toLowerCase())
  );

  // Check if Contact Picker API is available
  const isContactPickerSupported = 'contacts' in navigator && 'ContactsManager' in window;

  const handlePickContact = async () => {
    try {
      const props = ['name', 'email', 'tel', 'address'];
      const opts = { multiple: false };
      
      // @ts-ignore - Contact Picker API types not in standard lib
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        
        // Parse name
        if (contact.name && contact.name.length > 0) {
          const fullName = contact.name[0];
          const parts = fullName.trim().split(/\s+/);
          if (parts.length >= 2) {
            setNewClientFirstName(parts[0]);
            setNewClientLastName(parts.slice(1).join(' '));
          } else {
            setNewClientFirstName(fullName);
            setNewClientLastName("");
          }
        }
        
        // Set email
        if (contact.email && contact.email.length > 0) {
          setNewClientEmail(contact.email[0]);
        }
        
        // Set phone
        if (contact.tel && contact.tel.length > 0) {
          setNewClientPhone(contact.tel[0]);
        }
        
        // Set address
        if (contact.address && contact.address.length > 0) {
          const addr = contact.address[0];
          const addressParts = [
            addr.streetAddress,
            addr.locality,
            addr.postalCode,
            addr.country
          ].filter(Boolean);
          setNewClientAddress(addressParts.join(', '));
        }
        
        setDialogOpen(true);
        toast.success("Kontakt načten");
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error picking contact:", error);
        toast.error("Nepodařilo se načíst kontakt");
      }
    }
  };

  return (
    <>
      <div className="flex gap-2">
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
                    removeDiacritics(`${client.first_name} ${client.last_name}`).toLowerCase().includes(removeDiacritics(searchValue).toLowerCase())
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
      
      {isContactPickerSupported && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handlePickContact}
          title="Vybrat z kontaktů"
        >
          <Contact className="h-4 w-4" />
        </Button>
      )}
      </div>

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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="passportNumber">Číslo cestovního pasu</Label>
                <Input
                  id="passportNumber"
                  value={newClientPassportNumber}
                  onChange={(e) => setNewClientPassportNumber(e.target.value)}
                  placeholder="např. 12345678"
                />
              </div>
              <div>
                <Label htmlFor="passportExpiry">Platnost cestovního pasu</Label>
                <DateInput
                  value={newClientPassportExpiry}
                  onChange={(date) => setNewClientPassportExpiry(date)}
                  placeholder="DD.MM.RR"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="idCardNumber">Číslo občanského průkazu</Label>
                <Input
                  id="idCardNumber"
                  value={newClientIdCardNumber}
                  onChange={(e) => setNewClientIdCardNumber(e.target.value)}
                  placeholder="např. 123456789"
                />
              </div>
              <div>
                <Label htmlFor="idCardExpiry">Platnost občanského průkazu</Label>
                <DateInput
                  value={newClientIdCardExpiry}
                  onChange={(date) => setNewClientIdCardExpiry(date)}
                  placeholder="DD.MM.RR"
                />
              </div>
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
