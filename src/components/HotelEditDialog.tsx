import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HotelImageUpload } from "@/components/HotelImageUpload";
import { DestinationCombobox } from "@/components/DestinationCombobox";
import { Plus, Trash2, Sparkles, Loader2 as SpinIcon, Star } from "lucide-react";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGlobalHistory } from "@/hooks/useGlobalHistory";

interface GolfCourseData {
  name: string;
  par: number | null;
  holes: number | null;
  length: string | null;
  architect: string | null;
  is_hotel_course: boolean;
  distance_km: number | null;
  rating: number | null;
}

interface HotelTemplate {
  id: string;
  name: string;
  slug?: string | null;
  subtitle?: string | null;
  description?: string | null;
  nights?: string | null;
  green_fees?: string | null;
  price_label?: string | null;
  golf_courses?: string | null;
  golf_courses_data?: any;
  benefits?: any;
  room_types?: any;
  highlights?: any;
  is_published?: boolean | null;
  review_score?: number | null;
  star_category?: number | null;
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
  website_url?: string | null;
  destination_id?: string | null;
}

interface HotelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotel: HotelTemplate;
  onSaved?: (hotel: HotelTemplate) => void;
}

export function HotelEditDialog({ open, onOpenChange, hotel, onSaved }: HotelEditDialogProps) {
  const [_saving, setSaving] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [ratingNote, setRatingNote] = useState<string | null>(null);
  const [currentHotel, setCurrentHotel] = useState<HotelTemplate>(hotel);
  const { setIsSaving, setLastSaved } = useGlobalHistory();
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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

  // Track whether auto-fetch has already been triggered for this hotel
  const autoFetchDone = useRef<string | null>(null);
  // Controls whether HotelImageUpload should auto-scrape (only on first open)
  const [autoScrape, setAutoScrape] = useState(false);

  const [formData, setFormData] = useState({
    name: hotel.name || "",
    slug: hotel.slug || "",
    subtitle: hotel.subtitle || "",
    nights: hotel.nights || "",
    green_fees: hotel.green_fees || "",
    price_label: hotel.price_label || "",
    golf_courses: hotel.golf_courses || "",
    golf_courses_data: (Array.isArray(hotel.golf_courses_data) ? hotel.golf_courses_data : []) as GolfCourseData[],
    website_url: hotel.website_url || "",
    is_published: hotel.is_published || false,
    destination_id: hotel.destination_id || "",
    highlights: (Array.isArray(hotel.highlights) ? hotel.highlights : []) as Array<{ icon: string; title: string; text: string }>,
    review_score: hotel.review_score ?? null as number | null,
    star_category: hotel.star_category ?? null as number | null,
  });

  // Auto-fetch AI data only when hotel has no data yet (first time creation)
  const hotelIsNew = !hotel.image_url && !hotel.review_score && !hotel.description && !hotel.subtitle;

  // Auto-save on form changes (debounced, only when dialog is open)
  useAutoSave({
    data: open ? formData : null,
    saveFn: async (data) => {
      if (!data || !open) return;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      try {
        const { data: saved, error } = await supabase
          .from("hotel_templates")
          .update({
            name: data.name.trim(),
            slug: data.slug.trim() || null,
            subtitle: data.subtitle.trim() || null,
            nights: data.nights.trim() || null,
            green_fees: data.green_fees.trim() || null,
            price_label: data.price_label.trim() || null,
            golf_courses: data.golf_courses.trim() || null,
            golf_courses_data: data.golf_courses_data.length > 0 ? (data.golf_courses_data as any) : null,
            website_url: data.website_url.trim() || null,
            is_published: data.is_published,
            destination_id: data.destination_id || null,
            highlights: data.highlights.length > 0 ? data.highlights : null,
            review_score: data.review_score ?? null,
            star_category: data.star_category ?? null,
          })
          .eq("id", currentHotel.id)
          .select()
          .single();
        if (!error && saved) {
          setCurrentHotel(saved as HotelTemplate);
          onSaved?.(saved as HotelTemplate);
        }
        setLastSaved(new Date());
        setAutoSaveStatus('saved');
      } catch (e) {
        console.error("Auto-save hotel error:", e);
        setAutoSaveStatus('idle');
      } finally {
        setIsSaving(false);
      }
    },
    debounceMs: 1500,
    enabled: open && !!currentHotel.id,
  });

  useEffect(() => {
    if (open && hotel.id && hotelIsNew && autoFetchDone.current !== hotel.id) {
      autoFetchDone.current = hotel.id;
      setAutoScrape(true);
      handleFetchAll();
    }
    if (!open) {
      setAutoScrape(false);
    }
  }, [open, hotel.id]);

  const handleFetchAll = async () => {
    if (!hotel.name?.trim()) return;
    setFetchingAll(true);
    setRatingNote(null);
    toast.info("Získávám data pomocí AI…", { id: "ai-fetch" });

    try {
      // Run rating + suggest in parallel
      const [ratingRes, suggestRes] = await Promise.allSettled([
        supabase.functions.invoke("fetch-hotel-rating", { body: { hotelName: hotel.name } }),
        supabase.functions.invoke("suggest-hotel-destination", { body: { hotelName: hotel.name } }),
      ]);

      // Handle rating
      if (ratingRes.status === "fulfilled" && !ratingRes.value.error) {
        const d = ratingRes.value.data;
        if (d?.average != null) {
          setFormData((f) => ({ ...f, review_score: d.average }));
          setRatingNote(d.note ?? null);
        }
      }

      // Handle suggest
      if (suggestRes.status === "fulfilled" && !suggestRes.value.error) {
        const data = suggestRes.value.data;
        if (data && !data.error) {
          setAiSuggestion(data);

          setFormData((f) => {
            let next = { ...f };
            if (data.subtitle && !f.subtitle.trim()) next = { ...next, subtitle: data.subtitle };
            if (data.golf_courses && !f.golf_courses.trim()) next = { ...next, golf_courses: data.golf_courses };
            if (data.golf_courses_data?.length > 0 && f.golf_courses_data.length === 0) next = { ...next, golf_courses_data: data.golf_courses_data };
            if (data.highlights?.length > 0 && f.highlights.length === 0) next = { ...next, highlights: data.highlights };
            return next;
          });

          // Try to match destination
          const { data: destinations } = await supabase
            .from("destinations")
            .select("id, name, countries:country_id(name, iso_code)")
            .ilike("name", data.destination);
          const match = destinations?.find(
            (d: any) => d.name.toLowerCase() === data.destination.toLowerCase()
          );
          if (match) {
            setFormData((f) => ({ ...f, destination_id: match.id }));
            setAiSuggestion(null);
          }
        }
      }

      toast.success("Data z AI načtena", { id: "ai-fetch" });
    } catch (e) {
      console.error(e);
      toast.error("Chyba při načítání dat z AI", { id: "ai-fetch" });
    } finally {
      setFetchingAll(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
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
          review_score: formData.review_score ?? null,
          star_category: formData.star_category ?? null,
        })
        .eq("id", currentHotel.id)
        .select()
        .single();

      if (error) throw error;
      toast.success("Hotel uložen");
      if (data) {
        setCurrentHotel(data as HotelTemplate);
        onSaved?.(data as HotelTemplate);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes("duplicate") ? "Slug je již použitý" : "Nepodařilo se uložit");
    } finally {
      setSaving(false);
    }
  };

  const refreshHotel = async () => {
    const { data } = await supabase
      .from("hotel_templates")
      .select("*")
      .eq("id", currentHotel.id)
      .single();
    if (data) {
      setCurrentHotel(data as HotelTemplate);
      setFormData(f => ({ ...f, website_url: (data as any).website_url || "" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Upravit hotel</DialogTitle>
              <DialogDescription>Upravte údaje hotelu, fotky a popis</DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 mt-0.5"
              disabled={fetchingAll || !hotel.name?.trim()}
              onClick={handleFetchAll}
            >
              {fetchingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Získat data pomocí AI
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          {/* Basic info */}
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

          {/* Photos & description */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold">Fotky a popis</Label>
            <div className="mt-3">
              <HotelImageUpload
                hotelId={currentHotel.id}
                hotelName={currentHotel.name}
                imageUrl={currentHotel.image_url || null}
                imageUrl2={currentHotel.image_url_2 || null}
                imageUrl3={currentHotel.image_url_3 || null}
                imageUrl4={currentHotel.image_url_4 || null}
                imageUrl5={currentHotel.image_url_5 || null}
                imageUrl6={currentHotel.image_url_6 || null}
                imageUrl7={currentHotel.image_url_7 || null}
                imageUrl8={currentHotel.image_url_8 || null}
                imageUrl9={currentHotel.image_url_9 || null}
                imageUrl10={currentHotel.image_url_10 || null}
                description={currentHotel.description || null}
                websiteUrl={currentHotel.website_url || null}
                onUpdate={refreshHotel}
                autoScrape={autoScrape}
              />
            </div>
          </div>

          {/* Detail fields */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-4 block">Detaily hotelu</Label>

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
              <div>
                <Label>Celkové hodnocení (0–10)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="mt-1"
                  value={formData.review_score ?? ""}
                  onChange={(e) => setFormData((f) => ({ ...f, review_score: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Průměr Booking, TripAdvisor, Google"
                />
                {ratingNote && <p className="text-xs text-muted-foreground mt-0.5">{ratingNote}</p>}
                {!ratingNote && <p className="text-xs text-muted-foreground mt-0.5">Průměr z Booking.com, TripAdvisor a Google Reviews</p>}
              </div>
              <div>
                <Label>Kategorie (hvězdičky)</Label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, star_category: f.star_category === s ? null : s }))}
                      className="focus:outline-none transition-transform hover:scale-110"
                      title={`${s} hvězd${s === 1 ? "a" : s < 5 ? "y" : ""}`}
                    >
                      <Star
                        className="h-6 w-6"
                        fill={formData.star_category != null && s <= formData.star_category ? "#f59e0b" : "none"}
                        stroke={formData.star_category != null && s <= formData.star_category ? "#f59e0b" : "#9ca3af"}
                      />
                    </button>
                  ))}
                  {formData.star_category != null && (
                    <span className="text-sm text-muted-foreground ml-1">{formData.star_category}★</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Oficiální hvězdičková kategorizace hotelu</p>
              </div>

              {/* Golf courses */}
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
                        golf_courses_data: [...f.golf_courses_data, { name: "", par: null, holes: null, length: null, architect: null, is_hotel_course: true, distance_km: null, rating: null }],
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
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        <div>
                          <Label className="text-xs">Jamky</Label>
                          <Input type="number" value={gc.holes ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], holes: e.target.value ? Number(e.target.value) : null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="18" />
                        </div>
                        <div>
                          <Label className="text-xs">PAR</Label>
                          <Input type="number" value={gc.par ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], par: e.target.value ? Number(e.target.value) : null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="72" />
                        </div>
                        <div>
                          <Label className="text-xs">Délka</Label>
                          <Input value={gc.length ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], length: e.target.value || null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="6321 m" />
                        </div>
                        <div>
                          <Label className="text-xs">Architekt</Label>
                          <Input value={gc.architect ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], architect: e.target.value || null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="Michel Gayon" />
                        </div>
                        <div>
                          <Label className="text-xs">Vzdálenost (km)</Label>
                          <Input type="number" value={gc.distance_km ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], distance_km: e.target.value ? Number(e.target.value) : null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="0" disabled={gc.is_hotel_course} />
                        </div>
                        <div>
                          <Label className="text-xs">Rating (0-10)</Label>
                          <Input type="number" step="0.1" min="0" max="10" value={gc.rating ?? ""} onChange={(e) => { const u = [...formData.golf_courses_data]; u[idx] = { ...u[idx], rating: e.target.value ? Number(e.target.value) : null }; setFormData((f) => ({ ...f, golf_courses_data: u })); }} placeholder="8.5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={gc.is_hotel_course}
                          onCheckedChange={(v) => {
                            const u = [...formData.golf_courses_data];
                            u[idx] = { ...u[idx], is_hotel_course: v, distance_km: v ? null : u[idx].distance_km };
                            setFormData((f) => ({ ...f, golf_courses_data: u }));
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

          {/* Highlights */}
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

        <div className="flex justify-end border-t pt-4 shrink-0 gap-3 items-center">
          {autoSaveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <SpinIcon className="h-3 w-3 animate-spin" />Ukládám…
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-emerald-500" />Uloženo
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
