import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowLeft, ExternalLink, MapPin, Target, Star, UtensilsCrossed, Users, Calendar, Waves, Sun, Mountain, Trophy, Heart, Gem, Shield, Compass, Palmtree, Building } from "lucide-react";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";

const iconMap: Record<string, any> = {
  MapPin, Target, Star, UtensilsCrossed, Users, Calendar, Waves, Sun, Mountain, Trophy, Heart, Gem, Shield, Compass, Palmtree, Building,
};

interface Highlight {
  icon: string;
  title: string;
  text: string;
}

interface GolfCourseData {
  name: string;
  par: number | null;
  length: string | null;
  architect: string | null;
  is_hotel_course: boolean;
  distance_km: number | null;
  rating: number | null;
}

interface HotelDetail {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  nights: string | null;
  green_fees: string | null;
  golf_courses: string | null;
  golf_courses_data: GolfCourseData[] | null;
  price_label: string | null;
  benefits: any;
  room_types: any;
  highlights: Highlight[] | null;
  website_url: string | null;
  images: string[];
  star_category: number | null;
}

function HeroGallery({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [next, prev]);

  if (images.length === 0) return null;

  const thumbs = images.length > 1 ? images.filter((_, i) => i !== current).slice(0, 2) : [];

  return (
    <div ref={containerRef} tabIndex={0} className="outline-none" role="region" aria-label="Fotogalerie hotelu">
      <div className="relative aspect-[16/9] overflow-hidden cursor-pointer group" onClick={next}>
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
            <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {current + 1} / {images.length}
            </div>
          </>
        )}
      </div>
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

function parseBenefits(benefits: any): string[] {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits.filter((b): b is string => typeof b === "string");
  if (typeof benefits === "object") return Object.values(benefits).filter((b): b is string => typeof b === "string");
  return [];
}

function parseRoomTypes(roomTypes: any): Array<{ name: string; description?: string }> {
  if (!roomTypes) return [];
  if (Array.isArray(roomTypes)) {
    return roomTypes.map((r) => {
      if (typeof r === "string") return { name: r };
      if (typeof r === "object" && r !== null) return { name: r.name || r.type || "", description: r.description };
      return { name: String(r) };
    }).filter(r => r.name);
  }
  return [];
}

export default function PublicHotelDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchHotel = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/get-hotel-data?slug=${encodeURIComponent(slug)}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) {
          setError(res.status === 404 ? "Hotel nebyl nalezen" : "Nepodařilo se načíst hotel");
          return;
        }
        setHotel(await res.json());
      } catch {
        setError("Nepodařilo se načíst hotel");
      } finally {
        setLoading(false);
      }
    };
    fetchHotel();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítání hotelu...</div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-700">{error || "Hotel nenalezen"}</h1>
          <Link to="/hotely" className="text-blue-600 hover:underline text-sm">← Zpět na seznam hotelů</Link>
        </div>
      </div>
    );
  }

  const benefits = parseBenefits(hotel.benefits);
  const roomTypes = parseRoomTypes(hotel.room_types);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/hotely" className="text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <img src={yaroLogoWide} alt="YARO Travel" className="h-8" />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <a href="tel:+420602102108" className="hover:text-slate-700 transition-colors">📞 +420 602 102 108</a>
            <span className="hidden sm:inline">|</span>
            <a href="mailto:radek@yarotravel.cz" className="hidden sm:inline hover:text-slate-700 transition-colors">✉️ radek@yarotravel.cz</a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Gallery */}
        {hotel.images.length > 0 && (
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <HeroGallery images={hotel.images} alt={hotel.name} />
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800">{hotel.name}</h1>
            {hotel.star_category != null && (
              <span className="text-2xl" style={{ color: "#f59e0b" }}>
                {"★".repeat(hotel.star_category)}
              </span>
            )}
          </div>
          {hotel.subtitle && <p className="text-lg text-slate-500">{hotel.subtitle}</p>}
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-3">
          {hotel.nights && (
            <span className="bg-white border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-full shadow-sm">
              🌙 {hotel.nights}
            </span>
          )}
          {hotel.green_fees && (
            <span className="bg-white border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-full shadow-sm">
              ⛳ Green fees: {hotel.green_fees}
            </span>
          )}
          {hotel.golf_courses && !hotel.golf_courses_data?.length && (
            <span className="bg-white border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-full shadow-sm">
              🏌️ {hotel.golf_courses}
            </span>
          )}
          {hotel.price_label && (
            <span className="bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full shadow-sm">
              {hotel.price_label}
            </span>
          )}
        </div>

        {/* Description */}
        {hotel.description && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div
              className="prose prose-slate max-w-none text-slate-600 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: hotel.description }}
            />
          </div>
        )}

        {/* Golf courses */}
        {hotel.golf_courses_data && hotel.golf_courses_data.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">⛳ Golfová hřiště</h2>
            <div className="space-y-3">
              {hotel.golf_courses_data.map((gc, i) => (
                <div key={i} className="border-l-2 border-emerald-400 pl-4 py-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-medium text-slate-700">{gc.name}</p>
                    {!gc.is_hotel_course && gc.distance_km != null && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        📍 {gc.distance_km} km
                      </span>
                    )}
                    {gc.is_hotel_course && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        Vlastní hřiště
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                    {gc.rating != null && (
                      <span className="font-semibold text-amber-600">⭐ {gc.rating.toFixed(1)}</span>
                    )}
                    {gc.par != null && <span>PAR {gc.par}</span>}
                    {gc.length && <span>{gc.length}</span>}
                    {gc.architect && <span>Architekt: {gc.architect}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hotel.highlights && hotel.highlights.length > 0 && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                Proč si vybrat {hotel.name}?
              </h2>
              <p className="text-slate-500">
                Objevte výhody, díky kterým se k nám hosté vracejí rok co rok
              </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotel.highlights.map((h, i) => {
                const IconComp = iconMap[h.icon] || Star;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                      <IconComp className="h-5 w-5 text-amber-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">{h.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{h.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Bottom tiles */}
            <div className={`grid gap-3 ${hotel.highlights.length <= 4 ? `grid-cols-2 md:grid-cols-${hotel.highlights.length}` : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
              {hotel.highlights.slice(0, 4).map((h, i) => {
                const IconComp = iconMap[h.icon] || Star;
                return (
                  <div
                    key={i}
                    className="bg-slate-50 rounded-xl border border-slate-200 py-5 px-4 flex flex-col items-center gap-2 text-center"
                  >
                    <IconComp className="h-6 w-6 text-amber-600" />
                    <span className="text-sm font-medium text-slate-700">{h.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Benefits */}
        {benefits.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Cena zahrnuje</h2>
            <ul className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Room types */}
        {roomTypes.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Typy pokojů</h2>
            <div className="space-y-3">
              {roomTypes.map((r, i) => (
                <div key={i} className="border-l-2 border-blue-300 pl-4">
                  <p className="font-medium text-slate-700">{r.name}</p>
                  {r.description && <p className="text-sm text-slate-500">{r.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-wrap gap-3">
          {hotel.website_url && (
            <a
              href={hotel.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Web hotelu
            </a>
          )}
          <a
            href="mailto:radek@yarotravel.cz?subject=Zájem o hotel"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
          >
            ✉️ Kontaktujte nás
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/60 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
            <a href="tel:+420602102108" className="hover:text-slate-700 transition-colors">📞 +420 602 102 108</a>
            <a href="mailto:radek@yarotravel.cz" className="hover:text-slate-700 transition-colors">✉️ radek@yarotravel.cz</a>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} YARO Travel s.r.o. · Bratranců Veverkových 680, Pardubice
          </p>
        </div>
      </footer>
    </div>
  );
}
