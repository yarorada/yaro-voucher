import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";
import { Plane, Hotel, Navigation, Car, Shield, FileText } from "lucide-react";
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
      person_count: number | null;
      details: any;
    }>;
  }>;
  directServices: Array<{
    id: string;
    service_type: string;
    service_name: string;
    description: string | null;
    price: number | null;
    person_count: number | null;
    details: any;
    start_date: string | null;
    end_date: string | null;
  }>;
  hotelImages: Record<string, { image_url: string | null; image_url_2: string | null; image_url_3: string | null; description: string | null }>;
  hasSelectedVariant: boolean;
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

function formatPrice(price: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(price);
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
  const images = hotelService ? hotelImages[hotelService.service_name] : null;
  const dest = variant.destination;

  const totalPrice = variant.total_price || variant.deal_variant_services.reduce(
    (sum, s) => sum + (s.price || 0) * ((s as any).quantity || 1), 0
  );

  return (
    <div className={`rounded-2xl overflow-hidden bg-white shadow-lg border transition-all ${
      isSelected ? "ring-2 ring-blue-500 shadow-blue-100" : "border-slate-200"
    }`}>
      {/* Hero image */}
      {images?.image_url && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={images.image_url}
            alt={hotelService?.service_name || "Hotel"}
            className="w-full h-full object-cover"
          />
          {showBadge && (
            <div className="absolute top-3 left-3">
              <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                {variant.variant_name}
              </span>
            </div>
          )}
          {isSelected && (
            <div className="absolute top-3 right-3">
              <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                Doporučená varianta
              </span>
            </div>
          )}
        </div>
      )}

      {/* Small images */}
      {(images?.image_url_2 || images?.image_url_3) && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {images?.image_url_2 && (
            <div className="aspect-[16/10] overflow-hidden">
              <img src={images.image_url_2} alt="Pokoj" className="w-full h-full object-cover" />
            </div>
          )}
          {images?.image_url_3 && (
            <div className="aspect-[16/10] overflow-hidden">
              <img src={images.image_url_3} alt="Golf / Pláž" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      {/* No hero image but has badge */}
      {!images?.image_url && showBadge && (
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
        {isValidDescription(images?.description ?? null) && (
          <p className="text-sm text-slate-500 leading-relaxed">{images!.description}</p>
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

        {/* Price */}
        {totalPrice > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-500">Celková cena</span>
              <span className="text-2xl font-bold text-slate-800">{formatPrice(totalPrice)} CZK</span>
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
  const images = hotelService ? hotelImages[hotelService.service_name] : null;

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-lg border border-slate-200 max-w-2xl mx-auto">
      {images?.image_url && (
        <div className="aspect-[16/9] overflow-hidden">
          <img src={images.image_url} alt="Hotel" className="w-full h-full object-cover" />
        </div>
      )}
      {(images?.image_url_2 || images?.image_url_3) && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {images?.image_url_2 && (
            <div className="aspect-[16/10] overflow-hidden">
              <img src={images.image_url_2} alt="Pokoj" className="w-full h-full object-cover" />
            </div>
          )}
          {images?.image_url_3 && (
            <div className="aspect-[16/10] overflow-hidden">
              <img src={images.image_url_3} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}
      <div className="p-5 space-y-4">
        {/* Hotel description */}
        {hotelService && isValidDescription(hotelImages[hotelService.service_name]?.description ?? null) && (
          <p className="text-sm text-slate-500 leading-relaxed">
            {hotelImages[hotelService.service_name].description}
          </p>
        )}
        <div className="space-y-2">
          {services.map((service) => {
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
        {totalPrice && totalPrice > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-500">Celková cena</span>
              <span className="text-2xl font-bold text-slate-800">{formatPrice(totalPrice)} CZK</span>
            </div>
          </div>
        )}
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
