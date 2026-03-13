import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";
import { Plane, Hotel, Navigation, Car, Shield, FileText, ChevronLeft, ChevronRight, CheckCircle2, Send, MapPin } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { getServiceTotal } from "@/lib/servicePrice";

interface OfferData {
  deal: {
    name: string | null;
    deal_number: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    total_price: number | null;
    destination: { id: string; name: string; country: { name: string; iso_code: string } } | null;
    lead_client_name: string | null;
  };
  variants: Array<{
    id: string;
    variant_name: string;
    start_date: string | null;
    end_date: string | null;
    total_price: number | null;
    is_selected: boolean;
    hide_price: boolean;
    notes: string | null;
    destination: { id: string; name: string; country: { name: string; iso_code: string } } | null;
    deal_variant_services: Array<{
      id: string;
      service_type: string;
      service_name: string;
      description: string | null;
      start_date: string | null;
      end_date: string | null;
      price: number | null;
      price_currency: string | null;
      person_count: number | null;
      quantity: number | null;
      details: any;
    }>;
  }>;
  directServices: Array<{
    id: string;
    service_type: string;
    service_name: string;
    description: string | null;
    price: number | null;
    price_currency: string | null;
    person_count: number | null;
    quantity: number | null;
    details: any;
    start_date: string | null;
    end_date: string | null;
  }>;
  hotelImages: Record<string, { image_url: string | null; image_url_2: string | null; image_url_3: string | null; image_url_4: string | null; image_url_5: string | null; image_url_6: string | null; image_url_7: string | null; image_url_8: string | null; image_url_9: string | null; image_url_10: string | null; description: string | null; golf_courses_data: any[] | null; review_score: number | null }>;
  hasSelectedVariant: boolean;
}

function getMainHotelName(data: OfferData): string | null {
  // From selected variant
  const selected = data.variants.find(v => v.is_selected);
  const hotelFromVariant = (selected || data.variants[0])?.deal_variant_services?.find(s => s.service_type === "hotel");
  if (hotelFromVariant) return hotelFromVariant.service_name;
  // From direct services
  const hotelDirect = data.directServices.find(s => s.service_type === "hotel");
  if (hotelDirect) return hotelDirect.service_name;
  return null;
}

function getHotelImageUrls(images: OfferData["hotelImages"][string] | null): string[] {
  if (!images) return [];
  return [
    images.image_url, images.image_url_2, images.image_url_3,
    images.image_url_4, images.image_url_5, images.image_url_6,
    images.image_url_7, images.image_url_8, images.image_url_9,
    images.image_url_10,
  ].filter((u): u is string => !!u);
}

function HeroGallery({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [next, prev]);

  if (images.length === 0) return null;

  // Show hero + up to 2 thumbnails below
  const thumbs = images.length > 1 ? images.filter((_, i) => i !== current).slice(0, 2) : [];

  return (
    <div ref={containerRef} tabIndex={0} className="outline-none" role="region" aria-label="Fotogalerie hotelu">
      {/* Hero image with carousel */}
      <div
        className="relative aspect-[16/9] overflow-hidden cursor-pointer group"
        onClick={next}
      >
        {images.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${alt} ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              i === current ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        ))}
        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Předchozí fotka"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Další fotka"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            {/* Counter */}
            <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {current + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {/* Two smaller images below */}
      {thumbs.length > 0 && (
        <div className={`grid gap-0.5 mt-0.5 ${thumbs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {thumbs.map((url, i) => {
            const imgIndex = images.indexOf(url);
            return (
              <div
                key={i}
                className="aspect-[16/7] overflow-hidden cursor-pointer"
                onClick={() => setCurrent(imgIndex)}
              >
                <img
                  src={url}
                  alt={`${alt} ${imgIndex + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const serviceIcons: Record<string, typeof Plane> = {
  flight: Plane,
  hotel: Hotel,
  golf: Navigation,
  transfer: Car,
  insurance: Shield,
  other: FileText,
};

const serviceLabels: Record<string, string> = {
  flight: "Let",
  hotel: "Hotel",
  golf: "Golf",
  transfer: "Transfer",
  insurance: "Pojištění",
  meal: "Strava",
  other: "Ostatní",
};

function formatPrice(price: number, currency?: string): string {
  const formatted = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(price);
  if (!currency || currency === "CZK") return `${formatted} CZK`;
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  return `${formatted} ${symbols[currency] || currency}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "d. MMMM yyyy", { locale: cs });
  } catch {
    return dateStr;
  }
}

function isValidDescription(text: string | null): boolean {
  if (!text) return false;
  // Filter out descriptions that are mostly URLs or garbage
  const urlPattern = /https?:\/\/\S+/g;
  const cleaned = text.replace(urlPattern, "").trim();
  // If after removing URLs less than 30 chars remain, it's not a real description
  return cleaned.length >= 30;
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "d.M.yyyy");
  } catch {
    return dateStr;
  }
}

interface PerPersonLine {
  label: string;
  personCount: number;
  pricePerPerson: number;
  currency: string;
}

function computePerPersonPrices(services: Array<{
  service_type: string;
  service_name: string;
  description: string | null;
  price: number | null;
  price_currency?: string | null;
  person_count: number | null;
  quantity: number | null;
  details: any;
}>): PerPersonLine[] {
  const hotels = services.filter(s => s.service_type === "hotel");
  const shared = services.filter(s => s.service_type !== "hotel");

  if (hotels.length === 0) return [];

  // Sum of shared services cost per person
  let sharedPerPerson = 0;
  shared.forEach(s => {
    const priceMode = s.details?.price_mode || "per_service";
    const price = s.price || 0;
    const persons = s.person_count || 1;
    const qty = s.quantity || 1;
    // per_person: price is already per person
    // per_service: total = price * qty, divide by persons to get per-person share
    const perPerson = priceMode === "per_person" ? price : (price * qty) / persons;
    sharedPerPerson += perPerson;
  });
  const currency = services.find(s => s.price_currency)?.price_currency || "CZK";

  return hotels.map(h => {
    const priceMode = h.details?.price_mode || "per_service";
    const price = h.price || 0;
    const persons = h.person_count || 1;
    const qty = h.quantity || 1;
    const hotelPerPerson = priceMode === "per_person" ? price : (price * qty) / persons;
    return {
      label: h.description || h.service_name,
      personCount: persons,
      pricePerPerson: Math.round(hotelPerPerson + sharedPerPerson),
      currency,
    };
  });
}

export default function PublicOffer() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [variantComments, setVariantComments] = useState<Record<string, string>>({});
  const [variantSubmitting, setVariantSubmitting] = useState<Record<string, boolean>>({});
  const [variantSubmitted, setVariantSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;
    const fetchOffer = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const urlParams = new URLSearchParams(window.location.search);
        const allParam = urlParams.get('all') === '1' ? '&all=1' : '';
        const variantsParam = urlParams.get('variants') ? `&variants=${urlParams.get('variants')}` : '';
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/get-public-offer?token=${encodeURIComponent(token)}${allParam}${variantsParam}`,
          { headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) {
          if (res.status === 404) {
            setError("Nabídka nebyla nalezena");
          } else {
            setError("Nepodařilo se načíst nabídku");
          }
          return;
        }
        setData(await res.json());
      } catch {
        setError("Nepodařilo se načíst nabídku");
      } finally {
        setLoading(false);
      }
    };
    fetchOffer();
  }, [token]);

  const submitResponse = async (variantName?: string, variantId?: string) => {
    if (!token) return;
    const isVariant = !!variantId;
    const currentComment = isVariant ? (variantComments[variantId] || "") : comment;

    if (isVariant) {
      setVariantSubmitting(prev => ({ ...prev, [variantId]: true }));
    } else {
      setSubmitting(true);
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-offer-response`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token, comment: currentComment, variant_name: variantName || undefined, variant_id: variantId || undefined }),
        }
      );
      if (res.ok) {
        if (isVariant) {
          setVariantSubmitted(prev => ({ ...prev, [variantId]: true }));
        } else {
          setSubmitted(true);
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      if (isVariant) {
        setVariantSubmitting(prev => ({ ...prev, [variantId]: false }));
      } else {
        setSubmitting(false);
      }
    }
  };

  const handleSubmitResponse = () => {
    // When there's exactly 1 variant, auto-pass its ID so it gets selected
    if (variants.length === 1) {
      return submitResponse(variants[0].variant_name, variants[0].id);
    }
    return submitResponse();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítání nabídky...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-700">{error || "Nabídka nenalezena"}</h1>
          <p className="text-slate-500">Zkontrolujte prosím odkaz</p>
        </div>
      </div>
    );
  }

  const { deal, variants, directServices, hotelImages, hasSelectedVariant } = data;
  const selectedVariant = variants.find((v: any) => v.is_selected);
  const destination = deal.destination || selectedVariant?.destination;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={yaroLogoWide} alt="YARO Travel" style={{ height: '40px', width: '160px', objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <a href="tel:+420602102108" className="hover:text-slate-700 transition-colors">📞 +420 602 102 108</a>
            <span>|</span>
            <a href="mailto:radek@yarotravel.cz" className="hover:text-slate-700 transition-colors">✉️ radek@yarotravel.cz</a>
          </div>
          <span className="text-sm font-medium text-slate-500 tracking-wide uppercase">Nabídka</span>
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 space-y-8 ${variants.length >= 3 ? "max-w-7xl" : "max-w-5xl"}`}>
        {/* Deal header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Nabídka pro {deal.lead_client_name || deal.name || "klienta"}
          </h1>
          {variants.length <= 1 && (
            <>
              {getMainHotelName(data) && (
                <p className="text-lg font-medium text-slate-600">{getMainHotelName(data)}</p>
              )}
              {destination && (
                <p className="text-base text-slate-500">
                  {destination.country?.name} – {destination.name}
                </p>
              )}
              {deal.start_date && deal.end_date && (
                <p className="text-base text-slate-400">
                  {formatDate(deal.start_date)} — {formatDate(deal.end_date)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Variants */}
        {variants.length > 0 ? (
          <div className={`grid gap-6 ${variants.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : variants.length > 1 ? "md:grid-cols-2" : ""}`}>
            {variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                hotelImages={hotelImages}
                isSelected={variant.is_selected}
                showBadge={!hasSelectedVariant && variants.length > 1}
                showResponseForm={variants.length > 1}
                comment={variantComments[variant.id] || ""}
                onCommentChange={(val) => setVariantComments(prev => ({ ...prev, [variant.id]: val }))}
                onSubmit={() => submitResponse(variant.variant_name, variant.id)}
                isSubmitting={variantSubmitting[variant.id] || false}
                isSubmitted={variantSubmitted[variant.id] || false}
              />
            ))}
          </div>
        ) : directServices.length > 0 ? (
          <DirectServicesCard services={directServices} hotelImages={hotelImages} totalPrice={deal.total_price} />
        ) : (
          <div className="text-center py-12 text-slate-400">Žádné služby</div>
        )}

        {/* Offer Response Section - only show global form when single variant or no variants */}
        {variants.length <= 1 && (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden bg-white shadow-lg border border-slate-200 p-6 md:p-8">
            {submitted ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <h3 className="text-xl font-bold text-slate-800">Děkujeme za Váš souhlas!</h3>
                <p className="text-slate-500">Vaše odpověď byla odeslána. Brzy se Vám ozveme.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Máte zájem o tuto nabídku?</h3>
                <p className="text-sm text-slate-500">
                  Pokud Vám nabídka vyhovuje, dejte nám vědět. Můžete přidat i poznámku s Vašimi požadavky.
                </p>
                <Textarea
                  placeholder="Vaše poznámky nebo požadavky (nepovinné)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[100px] bg-slate-50 border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
                <Button
                  onClick={handleSubmitResponse}
                  disabled={submitting}
                  className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  {submitting ? (
                    "Odesílání..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Souhlasím s nabídkou
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/60 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} YARO Travel s.r.o. · Bratranců Veverkových 680, Pardubice
          </p>
        </div>
      </footer>
    </div>
  );
}

function GolfCoursesTable({ courses }: { courses: any[] }) {
  if (!courses || courses.length === 0) return null;
  // Show up to 5 courses, sorted by distance
  const sorted = [...courses]
    .sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
    .slice(0, 5);

  return (
    <div className="space-y-2 pt-2">
      <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
        Golfová hřiště v okolí
      </h4>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="text-left font-medium py-1.5 px-1">Hřiště</th>
              <th className="text-right font-medium py-1.5 px-1 whitespace-nowrap">Délka (m)</th>
              <th className="text-right font-medium py-1.5 px-1">Rating</th>
              <th className="text-left font-medium py-1.5 px-1">Architekt</th>
              <th className="text-right font-medium py-1.5 px-1 whitespace-nowrap">Vzdálenost</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={i} className={`border-b border-slate-100 ${c.is_hotel_course ? "bg-emerald-50/50" : ""}`}>
                <td className="py-1.5 px-1 text-slate-700 font-medium">
                  {c.name}
                  {c.is_hotel_course && <span className="ml-1 text-emerald-600 text-[10px]">⛳</span>}
                </td>
                <td className="py-1.5 px-1 text-right text-slate-600">{c.length_m ? `${c.length_m.toLocaleString("cs-CZ")}` : "–"}</td>
                <td className="py-1.5 px-1 text-right text-slate-600">{c.rating ? c.rating.toFixed(1) : "–"}</td>
                <td className="py-1.5 px-1 text-slate-500">{c.architect || "–"}</td>
                <td className="py-1.5 px-1 text-right text-slate-500 whitespace-nowrap">
                  {c.is_hotel_course ? "resort" : c.distance_km ? `${c.distance_km} km` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariantCard({ variant, hotelImages, isSelected, showBadge, showResponseForm, comment, onCommentChange, onSubmit, isSubmitting, isSubmitted }: {
  variant: OfferData["variants"][0];
  hotelImages: OfferData["hotelImages"];
  isSelected: boolean;
  showBadge: boolean;
  showResponseForm?: boolean;
  comment?: string;
  onCommentChange?: (val: string) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
}) {
  const hotelService = variant.deal_variant_services.find(s => s.service_type === "hotel");
  const hotelImgData = hotelService ? hotelImages[hotelService.service_name] : null;
  const allImages = getHotelImageUrls(hotelImgData);
  const reviewScore = hotelImgData?.review_score ?? null;
  const dest = variant.destination;

  const totalPrice = variant.total_price || variant.deal_variant_services.reduce(
    (sum, s) => sum + getServiceTotal(s), 0
  );

  const currency = variant.deal_variant_services.find(s => s.price_currency)?.price_currency || "CZK";

  return (
    <div className={`rounded-2xl overflow-hidden bg-white shadow-lg border transition-all flex flex-col ${
      isSelected ? "ring-2 ring-blue-500 shadow-blue-100" : "border-slate-200"
    }`}>
      {/* Image carousel */}
      {allImages.length > 0 && (
        <div className="relative">
          <HeroGallery images={allImages} alt={hotelService?.service_name || "Hotel"} />
          {showBadge && (
            <div className="absolute top-3 left-3 z-10">
              <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                {variant.variant_name}
              </span>
            </div>
          )}
          {isSelected && (
            <div className="absolute top-3 right-3 z-10">
              <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                Doporučená varianta
              </span>
            </div>
          )}
        </div>
      )}

      {/* No images but has badge */}
      {allImages.length === 0 && showBadge && (
        <div className="px-5 pt-5">
          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            {variant.variant_name}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5 space-y-4 flex-1 flex flex-col">
        {/* Hotel name + destination + rating */}
        <div>
          {hotelService && (
            <h3 className="text-xl font-bold text-slate-800">{hotelService.service_name}</h3>
          )}
          {dest && (
            <p className="text-sm text-slate-500 mt-0.5">
              {dest.name}, {dest.country?.name}
            </p>
          )}
          {reviewScore != null && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-yellow-400 text-sm">★</span>
              <span className="text-sm font-semibold text-slate-700">{reviewScore.toFixed(1)}</span>
              <span className="text-xs text-slate-400">/10 · Booking, TripAdvisor, Google</span>
            </div>
          )}
        </div>
        {(variant.start_date || variant.end_date) && (
          <p className="text-sm text-slate-400">
            {formatDateShort(variant.start_date)} – {formatDateShort(variant.end_date)}
          </p>
        )}

        {/* Hotel description from website */}
        {isValidDescription(hotelImgData?.description ?? null) && (
          <div className="text-sm text-slate-500 leading-relaxed prose prose-sm prose-slate max-w-none [&>p]:mb-4 [&>p:last-child]:mb-0 [&_strong]:after:content-[':'] [&_b]:after:content-[':']" dangerouslySetInnerHTML={{ __html: hotelImgData!.description! }} />
        )}

        {/* Golf courses table */}
        {hotelImgData?.golf_courses_data && (
          <GolfCoursesTable courses={hotelImgData.golf_courses_data} />
        )}

        {/* Services heading */}
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider pt-2">Cena zahrnuje</h4>

        {/* Services */}
        {(() => {
          const services = variant.deal_variant_services;
          const hotelSvc = services.find(s => s.service_type === "hotel");
          const totalGreenFees = services.filter(s => s.service_type === "golf").reduce((sum, s) => sum + (s.quantity || 1), 0);
          const nightsFrom = variant.start_date && variant.end_date
            ? Math.round((new Date(variant.end_date).getTime() - new Date(variant.start_date).getTime()) / 86400000)
            : hotelSvc?.start_date && hotelSvc?.end_date
              ? Math.round((new Date(hotelSvc.end_date).getTime() - new Date(hotelSvc.start_date).getTime()) / 86400000)
              : null;
          const otherServices = services.filter(s => s.service_type !== "hotel" && s.service_type !== "golf");
          const Hotel = serviceIcons["hotel"] || FileText;
          const Golf = serviceIcons["golf"] || FileText;
          return (
            <div className="space-y-2">
              {hotelSvc && (
                <div className="flex items-start gap-3 text-sm">
                  <Hotel className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-slate-700">
                    {nightsFrom ? `${nightsFrom} nocí — ubytování v hotelu ${hotelSvc.service_name}` : `ubytování v hotelu ${hotelSvc.service_name}`}
                    {hotelSvc.description && `, ${hotelSvc.description}`}
                  </span>
                </div>
              )}
              {totalGreenFees > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <Golf className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-slate-700">{totalGreenFees}× green fee</span>
                </div>
              )}
              {otherServices.map((service) => {
                const Icon = serviceIcons[service.service_type] || FileText;
                return (
                  <div key={service.id} className="flex items-start gap-3 text-sm">
                    <Icon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-700">{service.service_name}</span>
                      {service.description && (
                        <span className="text-slate-400 ml-1">· {service.description}</span>
                      )}
                      {service.service_type === "flight" && service.details && (
                        <FlightInfo details={service.details} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Notes */}
        {variant.notes && (
          <ul className="text-xs text-slate-400 italic border-t pt-3 space-y-1 list-disc list-inside">
            {variant.notes.split('\n').filter(line => line.trim()).map((line, i) => (
              <li key={i}>{line.trim()}</li>
            ))}
          </ul>
        )}

        {/* Per-person price recap */}
        {(() => {
          const lines = computePerPersonPrices(variant.deal_variant_services);
          if (lines.length === 0) return null;
          return (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cena na osobu</p>
              {lines.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">{line.label} <span className="text-slate-400">({line.personCount} os.)</span></span>
                   <span className="font-semibold text-slate-700">{formatPrice(line.pricePerPerson, line.currency)}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Price */}
        {totalPrice > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-500">Celková cena</span>
               <span className="text-2xl font-bold text-slate-800">{formatPrice(totalPrice, currency)}</span>
            </div>
          </div>
        )}

        {/* Per-variant response form */}
        {showResponseForm && (
          <div className="border-t pt-4 mt-auto space-y-3">
            {isSubmitted ? (
              <div className="text-center space-y-2 py-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Děkujeme!</p>
                <p className="text-xs text-slate-500">Vaše odpověď byla odeslána.</p>
              </div>
            ) : (
              <>
                <Textarea
                  placeholder="Poznámky nebo požadavky (nepovinné)..."
                  value={comment || ""}
                  onChange={(e) => onCommentChange?.(e.target.value)}
                  className="min-h-[70px] text-sm bg-slate-50 border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  {isSubmitting ? "Odesílání..." : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Souhlasím s touto variantou
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DirectServicesCard({ services, hotelImages, totalPrice }: {
  services: OfferData["directServices"];
  hotelImages: OfferData["hotelImages"];
  totalPrice: number | null;
}) {
  const hotelService = services.find(s => s.service_type === "hotel");
  const hotelImgData = hotelService ? hotelImages[hotelService.service_name] : null;
  const allImages = getHotelImageUrls(hotelImgData);

  const currency = services.find(s => s.price_currency)?.price_currency || "CZK";

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-lg border border-slate-200 max-w-2xl mx-auto">
      {allImages.length > 0 && (
        <HeroGallery images={allImages} alt="Hotel" />
      )}
      <div className="p-5 space-y-4">
        {/* Hotel description */}
        {hotelService && isValidDescription(hotelImgData?.description ?? null) && (
          <div className="text-sm text-slate-500 leading-relaxed prose prose-sm prose-slate max-w-none [&>p]:mb-4 [&>p:last-child]:mb-0 [&_strong]:after:content-[':'] [&_b]:after:content-[':']" dangerouslySetInnerHTML={{ __html: hotelImgData!.description! }} />
        )}
        {/* Golf courses table */}
        {hotelImgData?.golf_courses_data && (
          <GolfCoursesTable courses={hotelImgData.golf_courses_data} />
        )}
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider pt-2">Cena zahrnuje</h4>
        {(() => {
          const hotelSvc = services.find(s => s.service_type === "hotel");
          const totalGreenFees = services.filter(s => s.service_type === "golf").reduce((sum, s) => sum + (s.quantity || 1), 0);
          const nightsFrom = hotelSvc?.start_date && hotelSvc?.end_date
            ? Math.round((new Date(hotelSvc.end_date).getTime() - new Date(hotelSvc.start_date).getTime()) / 86400000)
            : null;
          const otherServices = services.filter(s => s.service_type !== "hotel" && s.service_type !== "golf");
          const Hotel = serviceIcons["hotel"] || FileText;
          const Golf = serviceIcons["golf"] || FileText;
          return (
            <div className="space-y-2">
              {hotelSvc && (
                <div className="flex items-start gap-3 text-sm">
                  <Hotel className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-slate-700">
                    {nightsFrom ? `${nightsFrom} nocí — ubytování v hotelu ${hotelSvc.service_name}` : `ubytování v hotelu ${hotelSvc.service_name}`}
                    {hotelSvc.description && `, ${hotelSvc.description}`}
                  </span>
                </div>
              )}
              {totalGreenFees > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <Golf className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-slate-700">{totalGreenFees}× green fee</span>
                </div>
              )}
              {otherServices.map((service) => {
                const Icon = serviceIcons[service.service_type] || FileText;
                return (
                  <div key={service.id} className="flex items-start gap-3 text-sm">
                    <Icon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-700">{service.service_name}</span>
                      {service.description && (
                        <span className="text-slate-400 ml-1">· {service.description}</span>
                      )}
                      {service.service_type === "flight" && service.details && (
                        <FlightInfo details={service.details} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {totalPrice && totalPrice > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-500">Celková cena</span>
              <span className="text-2xl font-bold text-slate-800">{formatPrice(totalPrice, currency)}</span>
            </div>
          </div>
        )}
        {/* Per-person price recap */}
        {(() => {
          const lines = computePerPersonPrices(services);
          if (lines.length === 0) return null;
          return (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cena na osobu</p>
              {lines.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">{line.label} <span className="text-slate-400">({line.personCount} os.)</span></span>
                  <span className="font-semibold text-slate-700">{formatPrice(line.pricePerPerson, line.currency)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function FlightInfo({ details }: { details: any }) {
  if (!details) return null;
  const segments = details.outbound_segments || (details.outbound ? [details.outbound] : []);
  const returnSegments = details.return_segments || (details.return ? [details.return] : []);

  if (segments.length === 0 && returnSegments.length === 0) return null;

  const formatSegment = (s: any) => {
    const route = `${s.departure || "?"} → ${s.arrival || "?"}`;
    const parts: string[] = [route];
    if (s.departure_time || s.arrival_time) {
      parts.push(`${s.departure_time || ""} – ${s.arrival_time || ""}`);
    }
    if (s.date) {
      parts.push(formatDateShort(s.date));
    }
    if (s.airline && s.flight_number) {
      parts.push(`${s.airline}${s.flight_number}`);
    }
    return parts.join(" · ");
  };

  return (
    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
      {segments.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-medium">→</span>
          <span>{segments.map(formatSegment).join(" ✈ ")}</span>
        </div>
      )}
      {returnSegments.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-medium">←</span>
          <span>{returnSegments.map(formatSegment).join(" ✈ ")}</span>
        </div>
      )}
    </div>
  );
}
