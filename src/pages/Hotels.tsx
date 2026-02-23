import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HotelImageUpload } from "@/components/HotelImageUpload";
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
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Hotel,
  Globe,
  Image as ImageIcon,
  Sparkles,
  Loader2,
} from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { DestinationCombobox } from "@/components/DestinationCombobox";

interface GolfCourseData {
  name: string;
  par: number | null;
  length: string | null;
  architect: string | null;
  is_hotel_course: boolean;
  distance_km: number | null;
  rating: number | null;
}

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
  const [suggesting, setSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    destination: string;
    country: string;
    iso_code: string;
    confidence: string;
    subtitle?: string;
    golf_courses?: string;
    golf_courses_data?: GolfCourseData[];
    highlights?: Array<{ icon: string; title: string; text: string }>;
  } | null>(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    subtitle: "",
    nights: "",
    green_fees: "",
    price_label: "",
    golf_courses: "",
    golf_courses_data: [] as GolfCourseData[],
    website_url: "",
    is_published: false,
    destination_id: "",
    highlights: [] as Array<{ icon: string; title: string; text: string }>,
  });

  usePageToolbar(
    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
      <Plus className="h-4 w-4" />
      Přidat hotel
    </Button>,
    []
  );

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
      // Open edit dialog for the new hotel
      openEditDialog(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes("duplicate") ? "Hotel s tímto slugem již existuje" : "Nepodařilo se vytvořit hotel");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (hotel: HotelTemplate) => {
    setEditHotel(hotel);
    const parsedHighlights = Array.isArray(hotel.highlights) ? hotel.highlights : [];
    const parsedGolfCourses = Array.isArray(hotel.golf_courses_data) ? hotel.golf_courses_data : [];
    setFormData({
      name: hotel.name || "",
      slug: hotel.slug || "",
      subtitle: hotel.subtitle || "",
      nights: hotel.nights || "",
      green_fees: hotel.green_fees || "",
      price_label: hotel.price_label || "",
      golf_courses: hotel.golf_courses || "",
      golf_courses_data: parsedGolfCourses,
      website_url: hotel.website_url || "",
      is_published: hotel.is_published || false,
      destination_id: hotel.destination_id || "",
      highlights: parsedHighlights,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editHotel || !formData.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .update({
          name: formData.name.trim(),
          slug: formData.slug.trim() || null,
          subtitle: formData.subtitle.trim() || null,
          nights: formData.nights.trim() || null,
          green_fees: formData.green_fees.trim() || null,
          price_label: formData.price_label.trim() || null,
          golf_courses: formData.golf_courses.trim() || null,
          golf_courses_data: formData.golf_courses_data.length > 0 ? (formData.golf_courses_data as any) : null,
          website_url: formData.website_url.trim() || null,
          is_published: formData.is_published,
          destination_id: formData.destination_id || null,
          highlights: formData.highlights.length > 0 ? formData.highlights : null,
        })
        .eq("id", editHotel.id);
      if (error) throw error;
      toast.success("Hotel uložen");
      await fetchHotels();
      // Refresh editHotel
      const { data } = await supabase
        .from("hotel_templates")
        .select("*, destinations:destination_id(name, countries:country_id(name, iso_code))")
        .eq("id", editHotel.id)
        .single();
      if (data) setEditHotel(data as any);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes("duplicate") ? "Slug je již použitý" : "Nepodařilo se uložit");
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

  const togglePublished = async (hotel: HotelTemplate) => {
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .update({ is_published: !hotel.is_published })
        .eq("id", hotel.id);
      if (error) throw error;
      toast.success(hotel.is_published ? "Hotel skryt z webu" : "Hotel publikován na web");
      fetchHotels();
    } catch (error) {
      console.error(error);
      toast.error("Nepodařilo se změnit stav");
    }
  };

  const filtered = hotels.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const imageCount = (h: HotelTemplate) => {
    return [h.image_url, h.image_url_2, h.image_url_3, h.image_url_4, h.image_url_5,
      h.image_url_6, h.image_url_7, h.image_url_8, h.image_url_9, h.image_url_10]
      .filter(Boolean).length;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="container max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hotely</h1>
          <p className="text-muted-foreground">Správa hotelů, fotek a popisů pro CRM i webové stránky</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hledat hotel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Načítám hotely...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? "Žádný hotel nenalezen" : "Zatím nemáte žádné hotely"}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((hotel) => (
              <Card
                key={hotel.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => openEditDialog(hotel)}
              >
                <div className="aspect-[16/9] relative bg-muted">
                  {hotel.image_url ? (
                    <img
                      src={hotel.image_url}
                      alt={hotel.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Hotel className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {hotel.is_published && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Globe className="h-3 w-3" />
                        Web
                      </Badge>
                    )}
                    {imageCount(hotel) > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {imageCount(hotel)}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{hotel.name}</h3>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(hotel);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteHotel(hotel);
                        }}
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
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Upravit hotel</DialogTitle>
            <DialogDescription>Upravte údaje hotelu, fotky a popis</DialogDescription>
          </DialogHeader>
          {editHotel && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              {/* Basic info - Name & Slug */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Název hotelu *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>URL slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="gloria-verde"
                  />
                </div>
              </div>

              {/* Photos & description - moved here */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Fotky a popis</Label>
                <div className="mt-3">
                  <HotelImageUpload
                    hotelId={editHotel.id}
                    hotelName={editHotel.name}
                    imageUrl={editHotel.image_url}
                    imageUrl2={editHotel.image_url_2}
                    imageUrl3={editHotel.image_url_3}
                    imageUrl4={editHotel.image_url_4}
                    imageUrl5={editHotel.image_url_5}
                    imageUrl6={editHotel.image_url_6}
                    imageUrl7={editHotel.image_url_7}
                    imageUrl8={editHotel.image_url_8}
                    imageUrl9={editHotel.image_url_9}
                    imageUrl10={editHotel.image_url_10}
                    description={editHotel.description}
                    websiteUrl={editHotel.website_url}
                    onUpdate={async () => {
                      await fetchHotels();
                      const { data } = await supabase
                        .from("hotel_templates")
                        .select("*, destinations:destination_id(name, countries:country_id(name, iso_code))")
                        .eq("id", editHotel.id)
                        .single();
                      if (data) {
                        setEditHotel(data);
                        setFormData(f => ({
                          ...f,
                          website_url: data.website_url || "",
                        }));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Detail fields */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold">Detaily hotelu</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={suggesting || !formData.name.trim()}
                    onClick={async () => {
                      setSuggesting(true);
                      setAiSuggestion(null);
                      try {
                        const { data, error } = await supabase.functions.invoke("suggest-hotel-destination", {
                          body: { hotelName: formData.name },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        setAiSuggestion(data);

                        // Auto-fill subtitle if empty
                        if (data.subtitle && !formData.subtitle.trim()) {
                          setFormData((f) => ({ ...f, subtitle: data.subtitle }));
                          toast.success("Podtitulek navržen");
                        }

                        // Auto-fill golf courses if empty
                        if (data.golf_courses && !formData.golf_courses.trim()) {
                          setFormData((f) => ({ ...f, golf_courses: data.golf_courses }));
                        }
                        if (data.golf_courses_data?.length > 0 && formData.golf_courses_data.length === 0) {
                          setFormData((f) => ({ ...f, golf_courses_data: data.golf_courses_data }));
                          toast.success("Golfová hřiště navržena");
                        }

                        // Auto-fill highlights if empty
                        if (data.highlights?.length > 0 && formData.highlights.length === 0) {
                          setFormData((f) => ({ ...f, highlights: data.highlights }));
                          toast.success("Důvody pro výběr hotelu navrženy");
                        }

                        // Try to find existing destination match
                        const { data: destinations } = await supabase
                          .from("destinations")
                          .select("id, name, countries:country_id(name, iso_code)")
                          .ilike("name", data.destination);
                        const match = destinations?.find(
                          (d: any) => d.name.toLowerCase() === data.destination.toLowerCase()
                        );
                        if (match) {
                          setFormData((f) => ({ ...f, destination_id: match.id }));
                          toast.success(`Nalezena existující destinace: ${match.name}`);
                          setAiSuggestion(null);
                        }
                      } catch (e: any) {
                        console.error(e);
                        toast.error("Nepodařilo se získat návrh");
                      } finally {
                        setSuggesting(false);
                      }
                    }}
                  >
                    {suggesting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Navrhnout vše z AI
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Podtitulek</Label>
                    <Input
                      value={formData.subtitle}
                      onChange={(e) => setFormData((f) => ({ ...f, subtitle: e.target.value }))}
                      placeholder="5* golf resort v Belek"
                    />
                    {aiSuggestion?.subtitle && formData.subtitle !== aiSuggestion.subtitle && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline mt-1"
                        onClick={() => setFormData((f) => ({ ...f, subtitle: aiSuggestion.subtitle! }))}
                      >
                        AI návrh: {aiSuggestion.subtitle}
                      </button>
                    )}
                  </div>
                  <div>
                    <Label>Počet nocí</Label>
                    <Input
                      value={formData.nights}
                      onChange={(e) => setFormData((f) => ({ ...f, nights: e.target.value }))}
                      placeholder="7 nocí"
                    />
                  </div>
                  <div>
                    <Label>Green fees</Label>
                    <Input
                      value={formData.green_fees}
                      onChange={(e) => setFormData((f) => ({ ...f, green_fees: e.target.value }))}
                      placeholder="Unlimited green fees"
                    />
                  </div>
                  <div>
                    <Label>Cena</Label>
                    <Input
                      value={formData.price_label}
                      onChange={(e) => setFormData((f) => ({ ...f, price_label: e.target.value }))}
                      placeholder="37 900 Kč / os."
                    />
                  </div>

              {/* Structured golf courses */}
              <div className="sm:col-span-2 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Golfová hřiště – detaily</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData((f) => ({
                        ...f,
                        golf_courses_data: [...f.golf_courses_data, { name: "", par: null, length: null, architect: null, is_hotel_course: true, distance_km: null, rating: null }],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Přidat hřiště
                  </Button>
                </div>
                {aiSuggestion?.golf_courses_data && aiSuggestion.golf_courses_data.length > 0 && formData.golf_courses_data.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mb-3 gap-1"
                    onClick={() => setFormData((f) => ({ ...f, golf_courses_data: aiSuggestion.golf_courses_data! }))}
                  >
                    <Sparkles className="h-3 w-3" /> Použít AI návrh ({aiSuggestion.golf_courses_data.length} hřišť)
                  </Button>
                )}
                <div className="space-y-3">
                  {formData.golf_courses_data.map((gc, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={gc.name}
                          onChange={(e) => {
                            const updated = [...formData.golf_courses_data];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setFormData((f) => ({ ...f, golf_courses_data: updated }));
                          }}
                          placeholder="Název hřiště"
                          className="font-medium"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => {
                            const updated = formData.golf_courses_data.filter((_, i) => i !== idx);
                            setFormData((f) => ({ ...f, golf_courses_data: updated }));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <Label className="text-xs">PAR</Label>
                          <Input
                            type="number"
                            value={gc.par ?? ""}
                            onChange={(e) => {
                              const updated = [...formData.golf_courses_data];
                              updated[idx] = { ...updated[idx], par: e.target.value ? Number(e.target.value) : null };
                              setFormData((f) => ({ ...f, golf_courses_data: updated }));
                            }}
                            placeholder="72"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Délka</Label>
                          <Input
                            value={gc.length ?? ""}
                            onChange={(e) => {
                              const updated = [...formData.golf_courses_data];
                              updated[idx] = { ...updated[idx], length: e.target.value || null };
                              setFormData((f) => ({ ...f, golf_courses_data: updated }));
                            }}
                            placeholder="6321 m"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Architekt</Label>
                          <Input
                            value={gc.architect ?? ""}
                            onChange={(e) => {
                              const updated = [...formData.golf_courses_data];
                              updated[idx] = { ...updated[idx], architect: e.target.value || null };
                              setFormData((f) => ({ ...f, golf_courses_data: updated }));
                            }}
                            placeholder="Michel Gayon"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Vzdálenost (km)</Label>
                          <Input
                            type="number"
                            value={gc.distance_km ?? ""}
                            onChange={(e) => {
                              const updated = [...formData.golf_courses_data];
                              updated[idx] = { ...updated[idx], distance_km: e.target.value ? Number(e.target.value) : null };
                              setFormData((f) => ({ ...f, golf_courses_data: updated }));
                            }}
                            placeholder="0"
                            disabled={gc.is_hotel_course}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rating (0-10)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={gc.rating ?? ""}
                            onChange={(e) => {
                              const updated = [...formData.golf_courses_data];
                              updated[idx] = { ...updated[idx], rating: e.target.value ? Number(e.target.value) : null };
                              setFormData((f) => ({ ...f, golf_courses_data: updated }));
                            }}
                            placeholder="8.5"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={gc.is_hotel_course}
                          onCheckedChange={(v) => {
                            const updated = [...formData.golf_courses_data];
                            updated[idx] = { ...updated[idx], is_hotel_course: v, distance_km: v ? null : updated[idx].distance_km };
                            setFormData((f) => ({ ...f, golf_courses_data: updated }));
                          }}
                        />
                        <Label className="text-xs">Vlastní hřiště hotelu</Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                  <div className="sm:col-span-2">
                    <Label>Oficiální web hotelu</Label>
                    <Input
                      value={formData.website_url}
                      onChange={(e) => setFormData((f) => ({ ...f, website_url: e.target.value }))}
                      placeholder="https://www.gloriagolf.com"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Destinace / Země</Label>
                    {aiSuggestion && !formData.destination_id && (
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
                        <p>
                          AI návrh: <strong>{aiSuggestion.destination}</strong> – {aiSuggestion.country} ({aiSuggestion.iso_code})
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({aiSuggestion.confidence === "high" ? "vysoká jistota" : aiSuggestion.confidence === "medium" ? "střední jistota" : "nízká jistota"})
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Vyberte destinaci níže nebo vytvořte novou zadáním názvu do pole</p>
                      </div>
                    )}
                    <DestinationCombobox
                      value={formData.destination_id}
                      onValueChange={(v) => {
                        setFormData((f) => ({ ...f, destination_id: v }));
                        setAiSuggestion(null);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Highlights - reasons to choose */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Proč si vybrat tento hotel</Label>
                  {formData.highlights.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          highlights: [...f.highlights, { icon: "Star", title: "", text: "" }],
                        }))
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Přidat důvod
                    </Button>
                  )}
                </div>
                {aiSuggestion?.highlights && aiSuggestion.highlights.length > 0 && formData.highlights.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mb-3 gap-1"
                    onClick={() => setFormData((f) => ({ ...f, highlights: aiSuggestion.highlights! }))}
                  >
                    <Sparkles className="h-3 w-3" /> Použít AI návrh ({aiSuggestion.highlights.length} důvodů)
                  </Button>
                )}
                <div className="space-y-3">
                  {formData.highlights.map((h, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={h.title}
                          onChange={(e) => {
                            const updated = [...formData.highlights];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setFormData((f) => ({ ...f, highlights: updated }));
                          }}
                          placeholder="Nadpis důvodu"
                          className="font-medium"
                        />
                        <select
                          value={h.icon}
                          onChange={(e) => {
                            const updated = [...formData.highlights];
                            updated[idx] = { ...updated[idx], icon: e.target.value };
                            setFormData((f) => ({ ...f, highlights: updated }));
                          }}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {["MapPin","Target","Star","UtensilsCrossed","Users","Calendar","Waves","Sun","Mountain","Trophy","Heart","Gem","Shield","Compass","Palmtree","Building"].map(ic => (
                            <option key={ic} value={ic}>{ic}</option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => {
                            const updated = formData.highlights.filter((_, i) => i !== idx);
                            setFormData((f) => ({ ...f, highlights: updated }));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={h.text}
                        onChange={(e) => {
                          const updated = [...formData.highlights];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setFormData((f) => ({ ...f, highlights: updated }));
                        }}
                        placeholder="Popis důvodu (max 120 znaků)"
                        maxLength={120}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-sm font-medium">Publikovat na web</Label>
                  <p className="text-xs text-muted-foreground">Hotel bude viditelný na webových stránkách</p>
                </div>
                <Switch
                  checked={formData.is_published}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, is_published: v }))}
                />
              </div>

            </div>
          )}
          {editHotel && (
            <div className="flex justify-end border-t pt-4 shrink-0">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Ukládám..." : "Uložit údaje"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
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

      {/* Delete dialog */}
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
    </div>
  );
}
