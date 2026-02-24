import { useState, useEffect, useCallback, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Pencil, Loader2, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingService, setDeletingService] = useState<ServiceTemplate | null>(null);
  const [editingService, setEditingService] = useState<ServiceTemplate | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newEnglishName, setNewEnglishName] = useState("");
  const [translating, setTranslating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const translateName = useCallback(async (czechName: string) => {
    if (!czechName.trim()) {
      setNewEnglishName("");
      return;
    }
    
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-service-name', {
        body: { czechName }
      });
      
      if (error) throw error;
      if (data?.englishName) {
        setNewEnglishName(data.englishName);
      }
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setTranslating(false);
    }
  }, []);

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
          service_type: serviceType || null
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Šablona služby vytvořena");
      setServices([...services, data]);
      onChange(data.name);
      if (onSelect) onSelect(data.name);
      setNewServiceName("");
      setNewEnglishName("");
      setCreateDialogOpen(false);
      setOpen(false);
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Nepodařilo se vytvořit šablonu služby");
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

      toast.success("Šablona služby upravena");
      setServices(services.map(s => s.id === data.id ? data : s));
      onChange(data.name);
      if (onSelect) onSelect(data.name);
      setNewServiceName("");
      setNewEnglishName("");
      setEditDialogOpen(false);
      setEditingService(null);
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Nepodařilo se upravit šablonu služby");
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

  const handleDeleteClick = (service: ServiceTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingService(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("service_templates")
        .delete()
        .eq("id", deletingService.id);

      if (error) throw error;

      toast.success("Šablona služby smazána");
      setServices(services.filter(s => s.id !== deletingService.id));
      setDeleteDialogOpen(false);
      setDeletingService(null);
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Nepodařilo se smazat šablonu služby");
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch = removeDiacritics(service.name.toLowerCase()).includes(removeDiacritics(searchValue.toLowerCase()));
    const matchesType = !serviceType || service.service_type === serviceType;
    return matchesSearch && matchesType;
  });

  const showCreateOption = searchValue.trim() && 
    !services.some(s => s.name.toLowerCase() === searchValue.toLowerCase());

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => {
                e.stopPropagation();
                onChange(e.target.value);
              }}
              placeholder="Zadejte název služby..."
              className="pr-10"
              onFocus={() => setOpen(true)}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              type="button"
            >
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 bg-popover border border-border shadow-lg z-50" 
          style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '300px' }}
          align="start" 
          sideOffset={4}
        >
          <Command>
            <CommandInput 
              placeholder="Hledat v šablonách..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList className="max-h-64 overflow-y-auto">
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
                    Uložit "{searchValue}" jako šablonu
                  </Button>
                ) : (
                  "Žádná šablona nenalezena"
                )}
              </CommandEmpty>
              <CommandGroup heading="Šablony služeb">
                {filteredServices.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={service.name}
                    onSelect={() => {
                      onChange(service.name);
                      if (onSelect) onSelect(service.name);
                      setOpen(false);
                      setSearchValue("");
                      inputRef.current?.focus();
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === service.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="break-words">{service.name}</span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => handleEditClick(service, e)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteClick(service, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
            <DialogTitle>Vytvořit novou šablonu</DialogTitle>
            <DialogDescription>
              Uložte název služby jako šablonu pro budoucí použití
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="service-name">Název služby (česky) *</Label>
              <Input
                id="service-name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                onBlur={() => translateName(newServiceName)}
                placeholder="např. Ubytování"
              />
            </div>
            <div>
              <Label htmlFor="english-name" className="flex items-center gap-2">
                Název služby (anglicky) *
                {translating && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Input
                id="english-name"
                value={newEnglishName}
                onChange={(e) => setNewEnglishName(e.target.value)}
                placeholder={translating ? "Překládám..." : "e.g. Accommodation"}
                disabled={translating}
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
                {loading ? "Ukládám..." : "Uložit šablonu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit šablonu</DialogTitle>
            <DialogDescription>
              Změňte název šablony služby
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-service-name">Název služby (česky) *</Label>
              <Input
                id="edit-service-name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                onBlur={() => translateName(newServiceName)}
                placeholder="např. Ubytování"
              />
            </div>
            <div>
              <Label htmlFor="edit-english-name" className="flex items-center gap-2">
                Název služby (anglicky) *
                {translating && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Input
                id="edit-english-name"
                value={newEnglishName}
                onChange={(e) => setNewEnglishName(e.target.value)}
                placeholder={translating ? "Překládám..." : "e.g. Accommodation"}
                disabled={translating}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat šablonu služby?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat šablonu "{deletingService?.name}"? Tuto akci nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingService(null)}>
              Zrušit
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? "Mažu..." : "Smazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
