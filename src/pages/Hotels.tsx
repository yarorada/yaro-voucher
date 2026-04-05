import { useState, useEffect, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Pencil, Trash2, Hotel, Globe, Image as ImageIcon, MapPin, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { HotelEditDialog } from "@/components/HotelEditDialog";
import { HotelStars } from "@/components/HotelStars";

interface HotelTemplate {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  nights: string | null;
  green_fees: string | null;
  price_label: string | null;
  golf_courses: string | null;
  golf_courses_data: any;
  benefits: any;
  room_types: any;
  highlights: any;
  is_published: boolean | null;
  review_score: number | null;
  star_category: number | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  image_url_4: string | null;
  image_url_5: string | null;
  image_url_6: string | null;
  image_url_7: string | null;
  image_url_8: string | null;
  image_url_9: string | null;
  image_url_10: string | null;
  website_url: string | null;
  destination_id: string | null;
  destinations?: { name: string; countries: { name: string; iso_code: string } | null } | null;
  created_at: string;
  updated_at: string;
}

export default function Hotels() {
  const [hotels, setHotels] = useState<HotelTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editHotel, setEditHotel] = useState<HotelTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteHotel, setDeleteHotel] = useState<HotelTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newHotelName, setNewHotelName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showNoDestination, setShowNoDestination] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from("hotel_templates")
        .select("*, destinations:destination_id(name, countries:country_id(name, iso_code))")
        .order("name");
      if (error) throw error;
      setHotels(data || []);
    } catch (error) {
      console.error("Error fetching hotels:", error);
      toast.error("Nepodařilo se načíst hotely");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newHotelName.trim()) return;
    setSaving(true);
    try {
      const slug = newHotelName.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await supabase
        .from("hotel_templates")
        .insert({ name: newHotelName.trim(), slug })
        .select()
        .single();
      if (error) throw error;
      toast.success("Hotel vytvořen");
      setCreateDialogOpen(false);
      setNewHotelName("");
      await fetchHotels();
      setEditHotel(data as HotelTemplate);
      setEditDialogOpen(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes("duplicate") ? "Hotel s tímto slugem již existuje" : "Nepodařilo se vytvořit hotel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteHotel) return;
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .delete()
        .eq("id", deleteHotel.id);
      if (error) throw error;
      toast.success("Hotel smazán");
      setDeleteHotel(null);
      await fetchHotels();
    } catch (error) {
      console.error(error);
      toast.error("Nepodařilo se smazat hotel");
    }
  };

  // Compute unique countries sorted by hotel count
  const countries = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    hotels.forEach((h) => {
      const c = h.destinations?.countries?.name;
      if (c) map.set(c, { name: c, count: (map.get(c)?.count ?? 0) + 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [hotels]);

  // Compute destinations for selected country
  const destinationsForCountry = useMemo(() => {
    if (!selectedCountry) return [];
    const map = new Map<string, { name: string; count: number }>();
    hotels.forEach((h) => {
      if (h.destinations?.countries?.name !== selectedCountry) return;
      const d = h.destinations?.name;
      if (d) map.set(d, { name: d, count: (map.get(d)?.count ?? 0) + 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [hotels, selectedCountry]);

  const handleSelectCountry = (country: string | null) => {
    setSelectedCountry(country);
    setSelectedDestination(null);
    setShowNoDestination(false);
  };

  const filtered = hotels.filter((h) => {
    const matchesSearch = removeDiacritics(h.name.toLowerCase()).includes(removeDiacritics(search.toLowerCase()));
    if (!matchesSearch) return false;
    if (showNoDestination) return !h.destination_id;
    if (selectedCountry && h.destinations?.countries?.name !== selectedCountry) return false;
    if (selectedDestination && h.destinations?.name !== selectedDestination) return false;
    return true;
  });

  const hotelsWithoutDestination = hotels.filter((h) => !h.destinations).length;

  const countryLabel = showNoDestination
    ? "Bez destinace"
    : selectedCountry
      ? selectedDestination ?? selectedCountry
      : "Všechny země";

  usePageToolbar(
    <div className="flex items-center gap-2 w-full">
      <SmartSearchInput
        value={search}
        onChange={setSearch}
        noResults={filtered.length === 0}
        addLabel={`hotel „{text}"`}
        onAddNew={(text) => { setNewHotelName(text); setCreateDialogOpen(true); }}
        placeholder="Hledat hotel..."
        className="flex-1 min-w-0"
        inputClassName="h-8 text-xs"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0 max-w-[160px]">
            <Globe className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span className="truncate">{countryLabel}</span>
            <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => { handleSelectCountry(null); setShowNoDestination(false); }}>
            Všechny země <span className="ml-auto text-[10px] opacity-60">{hotels.length}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {countries.map((c) => (
            <DropdownMenuItem key={c.name} onClick={() => { handleSelectCountry(c.name); setShowNoDestination(false); }}>
              {c.name} <span className="ml-auto text-[10px] opacity-60">{c.count}</span>
            </DropdownMenuItem>
          ))}
          {hotelsWithoutDestination > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setShowNoDestination(true); setSelectedCountry(null); setSelectedDestination(null); }}>
                Bez destinace <span className="ml-auto text-[10px] opacity-60">{hotelsWithoutDestination}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>,
    [search, filtered.length, countryLabel, countries, hotelsWithoutDestination]
  );

  const imageCount = (h: HotelTemplate) =>
    [h.image_url, h.image_url_2, h.image_url_3, h.image_url_4, h.image_url_5,
      h.image_url_6, h.image_url_7, h.image_url_8, h.image_url_9, h.image_url_10]
      .filter(Boolean).length;

  

  return (
    <PageShell className="space-y-4">
        <div />

        {/* Destination sub-filter when country is selected */}
        {!loading && selectedCountry && destinationsForCountry.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            {destinationsForCountry.map((d) => (
              <button
                key={d.name}
                onClick={() => setSelectedDestination(selectedDestination === d.name ? null : d.name)}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                  selectedDestination === d.name
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {d.name}
                <span className="ml-0.5 text-[10px] opacity-60">{d.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Načítám hotely...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search || selectedCountry ? "Žádný hotel nenalezen" : "Zatím nemáte žádné hotely"}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((hotel) => (
              <Card
                key={hotel.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => { setEditHotel(hotel); setEditDialogOpen(true); }}
              >
                <div className="aspect-[16/9] relative bg-muted">
                  {hotel.image_url ? (
                    <img src={hotel.image_url} alt={hotel.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Hotel className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {hotel.is_published && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Globe className="h-3 w-3" />Web
                      </Badge>
                    )}
                    {imageCount(hotel) > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <ImageIcon className="h-3 w-3" />{imageCount(hotel)}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{hotel.name}</h3>
                      {hotel.star_category != null && (
                        <HotelStars stars={hotel.star_category} className="mt-0.5" />
                      )}
                      {hotel.review_score != null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-yellow-500 text-xs">★</span>
                          <span className="text-xs font-medium text-foreground">{hotel.review_score.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/10</span>
                        </div>
                      )}
                      {hotel.subtitle && (
                        <p className="text-sm text-muted-foreground truncate">{hotel.subtitle}</p>
                      )}
                      {hotel.destinations && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {hotel.destinations.name} – {hotel.destinations.countries?.name}
                        </p>
                      )}
                      {hotel.slug && (
                        <p className="text-xs text-muted-foreground/70 mt-1">/{hotel.slug}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setEditHotel(hotel); setEditDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteHotel(hotel); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {editHotel && (
        <HotelEditDialog
          open={editDialogOpen}
          onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditHotel(null); }}
          hotel={editHotel}
          onSaved={async () => { await fetchHotels(); }}
        />
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nový hotel</DialogTitle>
            <DialogDescription>Přidejte nový hotel do databáze</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Název hotelu *</Label>
              <Input
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
                placeholder="např. Gloria Verde Resort"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleCreate} disabled={saving || !newHotelName.trim()}>
                {saving ? "Vytvářím..." : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteHotel} onOpenChange={(v) => !v && setDeleteHotel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat hotel?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat hotel "{deleteHotel?.name}"? Tuto akci nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
