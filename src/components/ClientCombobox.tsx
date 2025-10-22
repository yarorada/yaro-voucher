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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface ClientComboboxProps {
  value: string;
  onChange: (value: string, clientId: string) => void;
  placeholder?: string;
}

export function ClientCombobox({ value, onChange, placeholder = "Vyberte klienta..." }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone")
        .order("last_name", { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("Jméno a příjmení jsou povinné");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Klient byl přidán");
      setClients([...clients, data]);
      const fullName = `${data.first_name} ${data.last_name}`;
      onChange(fullName, data.id);
      setFormData({ first_name: "", last_name: "", email: "", phone: "" });
      setIsDialogOpen(false);
      setOpen(false);
    } catch (error) {
      toast.error("Chyba při přidávání klienta");
    }
  };

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
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background z-50" align="start">
          <Command className="bg-background">
            <CommandInput placeholder="Hledat klienta..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-center">
                  {loading ? "Načítám..." : "Žádný klient nenalezen."}
                  {!loading && (
                    <Button
                      variant="ghost"
                      className="w-full mt-2"
                      onClick={() => {
                        setIsDialogOpen(true);
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Přidat nového klienta
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup>
                {clients.map((client) => {
                  const fullName = `${client.first_name} ${client.last_name}`;
                  return (
                    <CommandItem
                      key={client.id}
                      value={fullName}
                      onSelect={(currentValue) => {
                        onChange(currentValue, client.id);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === fullName ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{fullName}</span>
                        {client.email && (
                          <span className="text-xs text-muted-foreground">{client.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {clients.length > 0 && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setIsDialogOpen(true);
                      setOpen(false);
                    }}
                    className="cursor-pointer border-t"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Přidat nového klienta
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Přidat nového klienta</DialogTitle>
            <DialogDescription>
              Zadejte základní informace o klientovi
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name_quick">
                  Jméno <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="first_name_quick"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name_quick">
                  Příjmení <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="last_name_quick"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_quick">Email</Label>
              <Input
                id="email_quick"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_quick">Telefon</Label>
              <Input
                id="phone_quick"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setFormData({ first_name: "", last_name: "", email: "", phone: "" });
                }}
              >
                Zrušit
              </Button>
              <Button type="submit">Přidat</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
