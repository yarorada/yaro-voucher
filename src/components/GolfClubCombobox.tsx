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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GolfClubTemplate {
  id: string;
  name: string;
}

interface GolfClubComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (clubName: string) => void;
}

export function GolfClubCombobox({ value, onChange, onSelect }: GolfClubComboboxProps) {
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<GolfClubTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [editingClub, setEditingClub] = useState<GolfClubTemplate | null>(null);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    const { data, error } = await supabase
      .from('golf_club_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching golf clubs:', error);
      toast.error("Nepodařilo se načíst golfové kluby");
    } else {
      setClubs(data || []);
    }
  };

  const handleCreateClub = async () => {
    if (!newClubName.trim()) {
      toast.error("Prosím zadejte název golfového klubu");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('golf_club_templates')
        .insert({ name: newClubName.trim() })
        .select()
        .single();

      if (error) throw error;

      await fetchClubs();
      onChange(data.name);
      if (onSelect) {
        onSelect(data.name);
      }
      setNewClubName("");
      setCreateDialogOpen(false);
      toast.success("Golfový klub úspěšně vytvořen");
    } catch (error: any) {
      console.error('Error creating golf club:', error);
      if (error.code === '23505') {
        toast.error("Tento golfový klub již existuje");
      } else {
        toast.error("Nepodařilo se vytvořit golfový klub");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClub = async () => {
    if (!editingClub || !newClubName.trim()) {
      toast.error("Prosím zadejte název golfového klubu");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('golf_club_templates')
        .update({ name: newClubName.trim() })
        .eq('id', editingClub.id);

      if (error) throw error;

      await fetchClubs();
      if (value === editingClub.name) {
        onChange(newClubName.trim());
      }
      setNewClubName("");
      setEditingClub(null);
      setEditDialogOpen(false);
      toast.success("Golfový klub úspěšně aktualizován");
    } catch (error: any) {
      console.error('Error updating golf club:', error);
      if (error.code === '23505') {
        toast.error("Tento golfový klub již existuje");
      } else {
        toast.error("Nepodařilo se aktualizovat golfový klub");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (club: GolfClubTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClub(club);
    setNewClubName(club.name);
    setEditDialogOpen(true);
  };

  const filteredClubs = clubs.filter((club) =>
    club.name.toLowerCase().includes(value.toLowerCase())
  );

  const showCreateOption = value.trim() !== "" && 
    !clubs.some(club => club.name.toLowerCase() === value.toLowerCase());

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
                onChange(e.key);
              }
            }}
          >
            {value || "Vyberte golfový klub..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Hledat nebo vytvořit golfový klub..." 
              value={value}
              onValueChange={onChange}
            />
            <CommandList>
              <CommandEmpty>
                {showCreateOption ? (
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        setNewClubName(value);
                        setCreateDialogOpen(true);
                        setOpen(false);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Vytvořit "{value}"
                    </Button>
                  </div>
                ) : (
                  "Žádné golfové kluby nenalezeny."
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredClubs.map((club) => (
                  <CommandItem
                    key={club.id}
                    value={club.name}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      if (onSelect) {
                        onSelect(currentValue);
                      }
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.toLowerCase() === club.name.toLowerCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{club.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2"
                      onClick={(e) => handleEditClick(club, e)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </CommandItem>
                ))}
                {showCreateOption && filteredClubs.length > 0 && (
                  <CommandItem
                    onSelect={() => {
                      setNewClubName(value);
                      setCreateDialogOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Vytvořit "{value}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vytvořit nový golfový klub</DialogTitle>
            <DialogDescription>
              Zadejte název nového golfového klubu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clubName">Název golfového klubu</Label>
              <Input
                id="clubName"
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
                placeholder="např. Olympos GC"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateClub();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewClubName("");
              }}
            >
              Zrušit
            </Button>
            <Button onClick={handleCreateClub} disabled={loading}>
              {loading ? "Vytvářím..." : "Vytvořit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit golfový klub</DialogTitle>
            <DialogDescription>
              Změňte název golfového klubu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClubName">Název golfového klubu</Label>
              <Input
                id="editClubName"
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
                placeholder="např. Olympos GC"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateClub();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setNewClubName("");
                setEditingClub(null);
              }}
            >
              Zrušit
            </Button>
            <Button onClick={handleUpdateClub} disabled={loading}>
              {loading ? "Ukládám..." : "Uložit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
