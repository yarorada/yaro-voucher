import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Pencil } from "lucide-react";
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

interface ServiceTemplate {
  id: string;
  name: string;
  english_name?: string;
  service_type?: string;
}

interface ServiceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (serviceName: string) => void;
  serviceType?: string;
}

export function ServiceCombobox({ value, onChange, onSelect, serviceType }: ServiceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceTemplate | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newEnglishName, setNewEnglishName] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("service_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Nepodařilo se načíst služby");
    }
  };

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast.error("Název služby je povinný");
      return;
    }
    if (!newEnglishName.trim()) {
      toast.error("Anglický název služby je povinný");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_templates")
        .insert({ 
          name: newServiceName.trim(),
          english_name: newEnglishName.trim(),
          service_type: serviceType || 'other'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Služba vytvořena");
      setServices([...services, data]);
      onChange(data.name);
      if (onSelect) onSelect(data.name);
      setNewServiceName("");
      setNewEnglishName("");
      setCreateDialogOpen(false);
      setOpen(false);
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Nepodařilo se vytvořit službu");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService || !newServiceName.trim()) {
      toast.error("Název služby je povinný");
      return;
    }
    if (!newEnglishName.trim()) {
      toast.error("Anglický název služby je povinný");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_templates")
        .update({ 
          name: newServiceName.trim(),
          english_name: newEnglishName.trim()
        })
        .eq("id", editingService.id)
        .select()
        .single();

      if (error) throw error;

      toast.success("Služba upravena");
      setServices(services.map(s => s.id === data.id ? data : s));
      onChange(data.name);
      if (onSelect) onSelect(data.name);
      setNewServiceName("");
      setNewEnglishName("");
      setEditDialogOpen(false);
      setEditingService(null);
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Nepodařilo se upravit službu");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (service: ServiceTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingService(service);
    setNewServiceName(service.name);
    setNewEnglishName(service.english_name || "");
    setEditDialogOpen(true);
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesType = !serviceType || service.service_type === serviceType || !service.service_type;
    return matchesSearch && matchesType;
  });

  const showCreateOption = searchValue.trim() && 
    !services.some(s => s.name.toLowerCase() === searchValue.toLowerCase());

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
            {value || "Vyberte službu..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-popover z-50" align="start">
          <Command>
            <CommandInput 
              placeholder="Hledat službu..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {showCreateOption ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewServiceName(searchValue);
                      setCreateDialogOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvořit "{searchValue}"
                  </Button>
                ) : (
                  "Služba nenalezena"
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredServices.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={service.name}
                    onSelect={() => {
                      onChange(service.name);
                      if (onSelect) onSelect(service.name);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center flex-1">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === service.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {service.name}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => handleEditClick(service, e)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vytvořit novou službu</DialogTitle>
            <DialogDescription>
              Zadejte název nové služby
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="service-name">Název služby (česky) *</Label>
              <Input
                id="service-name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="např. Ubytování"
              />
            </div>
            <div>
              <Label htmlFor="english-name">Název služby (anglicky) *</Label>
              <Input
                id="english-name"
                value={newEnglishName}
                onChange={(e) => setNewEnglishName(e.target.value)}
                placeholder="e.g. Accommodation"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewServiceName("");
                  setNewEnglishName("");
                }}
              >
                Zrušit
              </Button>
              <Button onClick={handleCreateService} disabled={loading}>
                {loading ? "Vytvářím..." : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit službu</DialogTitle>
            <DialogDescription>
              Změňte název služby
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-service-name">Název služby (česky) *</Label>
              <Input
                id="edit-service-name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="např. Ubytování"
              />
            </div>
            <div>
              <Label htmlFor="edit-english-name">Název služby (anglicky) *</Label>
              <Input
                id="edit-english-name"
                value={newEnglishName}
                onChange={(e) => setNewEnglishName(e.target.value)}
                placeholder="e.g. Accommodation"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setNewServiceName("");
                  setNewEnglishName("");
                  setEditingService(null);
                }}
              >
                Zrušit
              </Button>
              <Button onClick={handleUpdateService} disabled={loading}>
                {loading ? "Ukládám..." : "Uložit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
