import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Plus, Pencil, Trash2 } from "lucide-react";
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
import { HotelImageUpload } from "@/components/HotelImageUpload";

interface HotelTemplate {
  id: string;
  name: string;
  image_url?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  image_url_4?: string | null;
  image_url_5?: string | null;
  image_url_6?: string | null;
  image_url_7?: string | null;
  image_url_8?: string | null;
  image_url_9?: string | null;
  image_url_10?: string | null;
  description?: string | null;
}

interface HotelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (hotelName: string) => void;
}

export function HotelCombobox({ value, onChange, onSelect }: HotelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [hotels, setHotels] = useState<HotelTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingHotel, setDeletingHotel] = useState<HotelTemplate | null>(null);
  const [editingHotel, setEditingHotel] = useState<HotelTemplate | null>(null);
  const [newHotelName, setNewHotelName] = useState("");
  const [autoScrapeOnOpen, setAutoScrapeOnOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from("hotel_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setHotels(data || []);
    } catch (error) {
      console.error("Error fetching hotels:", error);
      toast.error("Nepodařilo se načíst hotely");
    }
  };

  const handleCreateHotel = async () => {
    if (!newHotelName.trim()) {
      toast.error("Název hotelu je povinný");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hotel_templates")
        .insert({ name: newHotelName.trim() })
        .select()
        .single();

      if (error) throw error;

      toast.success("Hotel přidán do databáze");
      setHotels([...hotels, data]);
      onChange(data.name);
      setCreateDialogOpen(false);
      setOpen(false);
      // Auto-open edit dialog with scrape
      setEditingHotel(data);
      setNewHotelName(data.name);
      setAutoScrapeOnOpen(true);
      setEditDialogOpen(true);
    } catch (error) {
      console.error("Error creating hotel:", error);
      toast.error("Nepodařilo se vytvořit hotel");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHotel = async () => {
    if (!editingHotel || !newHotelName.trim()) {
      toast.error("Název hotelu je povinný");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hotel_templates")
        .update({ name: newHotelName.trim() })
        .eq("id", editingHotel.id)
        .select()
        .single();

      if (error) throw error;

      toast.success("Hotel upraven");
      setHotels(hotels.map(h => h.id === data.id ? data : h));
      onChange(data.name);
      setNewHotelName("");
      setEditDialogOpen(false);
      setEditingHotel(null);
    } catch (error) {
      console.error("Error updating hotel:", error);
      toast.error("Nepodařilo se upravit hotel");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHotel = async () => {
    if (!deletingHotel) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .delete()
        .eq("id", deletingHotel.id);

      if (error) throw error;

      toast.success("Hotel smazán");
      setHotels(hotels.filter(h => h.id !== deletingHotel.id));
      setDeleteDialogOpen(false);
      setDeletingHotel(null);
    } catch (error) {
      console.error("Error deleting hotel:", error);
      toast.error("Nepodařilo se smazat hotel");
    } finally {
      setLoading(false);
    }
  };

  const filteredHotels = hotels.filter((hotel) =>
    removeDiacritics(hotel.name.toLowerCase()).includes(removeDiacritics(searchValue.toLowerCase()))
  );

  const showCreateOption = searchValue.trim() &&
    !hotels.some(h => removeDiacritics(h.name.toLowerCase()) === removeDiacritics(searchValue.toLowerCase()));

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
              placeholder="Zadejte název hotelu..."
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
          onWheel={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput
              placeholder="Hledat v hotelech..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList className="max-h-64 overflow-auto" onWheel={(e) => e.stopPropagation()}>
              <CommandEmpty>
                {showCreateOption ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewHotelName(searchValue);
                      setCreateDialogOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Uložit "{searchValue}" jako hotel
                  </Button>
                ) : (
                  "Žádný hotel nenalezen"
                )}
              </CommandEmpty>
              <CommandGroup heading="Hotely">
                {filteredHotels.map((hotel) => (
                  <CommandItem
                    key={hotel.id}
                    value={hotel.name}
                    onSelect={() => {
                      onChange(hotel.name);
                      if (onSelect) onSelect(hotel.name);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === hotel.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="break-words">{hotel.name}</span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingHotel(hotel);
                          setNewHotelName(hotel.name);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingHotel(hotel);
                          setDeleteDialogOpen(true);
                        }}
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
            <DialogTitle>Přidat hotel</DialogTitle>
            <DialogDescription>Uložte hotel do databáze pro budoucí použití</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hotel-name">Název hotelu *</Label>
              <Input
                id="hotel-name"
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
                placeholder="např. Marriott Resort & Spa"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setNewHotelName(""); }}>
                Zrušit
              </Button>
              <Button onClick={handleCreateHotel} disabled={loading}>
                {loading ? "Ukládám..." : "Uložit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setAutoScrapeOnOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit hotel</DialogTitle>
            <DialogDescription>Změňte název hotelu nebo nahrajte fotky</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-hotel-name">Název hotelu *</Label>
              <Input
                id="edit-hotel-name"
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
                placeholder="např. Marriott Resort & Spa"
              />
            </div>
            {editingHotel && (
              <div>
                <Label>Fotky hotelu</Label>
                <div className="mt-2">
                  <HotelImageUpload
                    hotelId={editingHotel.id}
                    hotelName={editingHotel.name}
                    imageUrl={editingHotel.image_url || null}
                    imageUrl2={editingHotel.image_url_2 || null}
                    imageUrl3={editingHotel.image_url_3 || null}
                    imageUrl4={editingHotel.image_url_4 || null}
                    imageUrl5={editingHotel.image_url_5 || null}
                    imageUrl6={editingHotel.image_url_6 || null}
                    imageUrl7={editingHotel.image_url_7 || null}
                    imageUrl8={editingHotel.image_url_8 || null}
                    imageUrl9={editingHotel.image_url_9 || null}
                    imageUrl10={editingHotel.image_url_10 || null}
                    description={editingHotel.description || null}
                    autoScrape={autoScrapeOnOpen}
                    onUpdate={async () => {
                      await fetchHotels();
                      // Refresh editingHotel from DB so image previews update immediately
                      const { data } = await supabase
                        .from("hotel_templates")
                        .select("*")
                        .eq("id", editingHotel.id)
                        .single();
                      if (data) setEditingHotel(data);
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditDialogOpen(false); setNewHotelName(""); setEditingHotel(null); }}>
                Zrušit
              </Button>
              <Button onClick={handleUpdateHotel} disabled={loading}>
                {loading ? "Ukládám..." : "Uložit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat hotel?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat hotel "{deletingHotel?.name}"? Tuto akci nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingHotel(null)}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHotel}
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
