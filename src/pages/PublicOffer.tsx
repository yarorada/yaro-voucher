import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";
import { Plane, Hotel, Navigation, Car, Shield, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

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
  hotelImages: Record<string, { image_url: string | null; image_url_2: string | null; image_url_3: string | null; image_url_4: string | null; image_url_5: string | null; image_url_6: string | null; image_url_7: string | null; image_url_8: string | null; image_url_9: string | null; image_url_10: string | null; description: string | null }>;
  hasSelectedVariant: boolean;
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

  // Sum of shared services cost per person: each shared service total / its person_count
  let sharedPerPerson = 0;
  shared.forEach(s => {
    const total = (s.price || 0) * (s.quantity || 1);
    const persons = s.person_count || 1;
    sharedPerPerson += total / persons;
  });
  const currency = services.find(s => s.price_currency)?.price_currency || "CZK";

  return hotels.map(h => {
    const persons = h.person_count || 1;
    const hotelTotal = (h.price || 0) * (h.quantity || 1);
    const hotelPerPerson = hotelTotal / persons;
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

  useEffect(() => {
    if (!token) return;
    const fetchOffer = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/get-public-offer?token=${encodeURIComponent(token)}`,
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
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={yaroLogoWide} alt="YARO Travel" className="h-8" />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <a href="tel:+420602102108" className="hover:text-slate-700 transition-colors">📞 +420 602 102 108</a>
            <span>|</span>
            <a href="mailto:radek@yarotravel.cz" className="hover:text-slate-700 transition-colors">✉️ radek@yarotravel.cz</a>
          </div>
          <span className="text-sm font-medium text-slate-500 tracking-wide uppercase">Nabídka</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Deal header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Nabídka pro {deal.lead_client_name || deal.name || "klienta"}
          </h1>
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
        </div>

        {/* Variants */}
        {variants.length > 0 ? (
          <div className={`grid gap-8 ${variants.length > 1 ? "md:grid-cols-2" : ""}`}>
            {variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                hotelImages={hotelImages}
                isSelected={variant.is_selected}
                showBadge={!hasSelectedVariant && variants.length > 1}
              />
            ))}
          </div>
        ) : directServices.length > 0 ? (
          <DirectServicesCard services={directServices} hotelImages={hotelImages} totalPrice={deal.total_price} />
        ) : (
          <div className="text-center py-12 text-slate-400">Žádné služby</div>
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

function VariantCard({ variant, hotelImages, isSelected, showBadge }: {
  variant: OfferData["variants"][0];
  hotelImages: OfferData["hotelImages"];
  isSelected: boolean;
  showBadge: boolean;
}) {
  const hotelService = variant.deal_variant_services.find(s => s.service_type === "hotel");
  const hotelImgData = hotelService ? hotelImages[hotelService.service_name] : null;
  const allImages = getHotelImageUrls(hotelImgData);
  const dest = variant.destination;

  const totalPrice = variant.total_price || variant.deal_variant_services.reduce(
    (sum, s) => sum + (s.price || 0) * ((s as any).quantity || 1), 0
  );

  const currency = variant.deal_variant_services.find(s => s.price_currency)?.price_currency || "CZK";

  return (
    <div className={`rounded-2xl overflow-hidden bg-white shadow-lg border transition-all ${
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
      <div className="p-5 space-y-4">
        {/* Destination & dates */}
        {dest && (
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {dest.name}, {dest.country?.name}
            </h3>
          </div>
        )}
        {(variant.start_date || variant.end_date) && (
          <p className="text-sm text-slate-400">
            {formatDateShort(variant.start_date)} – {formatDateShort(variant.end_date)}
          </p>
        )}

        {/* Hotel description from website */}
        {isValidDescription(hotelImgData?.description ?? null) && (
          <div className="text-sm text-slate-500 leading-relaxed prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: hotelImgData!.description! }} />
        )}

        {/* Services */}
        <div className="space-y-2">
          {variant.deal_variant_services.map((service) => {
            const Icon = serviceIcons[service.service_type] || FileText;
            return (
              <div key={service.id} className="flex items-start gap-3 text-sm">
                <Icon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700">{service.service_name}</span>
                  {service.service_type === "hotel" && (service.quantity || 1) > 1 && (
                    <span className="text-slate-400 ml-1">· {service.quantity}× pokoj</span>
                  )}
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

        {/* Notes */}
        {variant.notes && (
          <p className="text-xs text-slate-400 italic border-t pt-3">{variant.notes}</p>
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
          <div className="text-sm text-slate-500 leading-relaxed prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: hotelImgData!.description! }} />
        )}
        <div className="space-y-2">
          {services.map((service) => {
            const Icon = serviceIcons[service.service_type] || FileText;
            return (
              <div key={service.id} className="flex items-start gap-3 text-sm">
                <Icon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700">{service.service_name}</span>
                  {service.service_type === "hotel" && (service.quantity || 1) > 1 && (
                    <span className="text-slate-400 ml-1">· {service.quantity}× pokoj</span>
                  )}
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
