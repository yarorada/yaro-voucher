import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";

interface Hotel {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string | null;
  nights: string | null;
  price_label: string | null;
  golf_courses: string | null;
  images: string[];
  star_category: number | null;
}

export default function PublicHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/get-hotel-data`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) throw new Error("Failed to fetch");
        setHotels(await res.json());
      } catch {
        setError("Nepodařilo se načíst hotely");
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítání hotelů...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-700">{error}</h1>
          <p className="text-slate-500">Zkuste to prosím později</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={yaroLogoWide} alt="YARO Travel" className="h-8" />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <a href="tel:+420602102108" className="hover:text-slate-700 transition-colors">📞 +420 602 102 108</a>
            <span className="hidden sm:inline">|</span>
            <a href="mailto:radek@yarotravel.cz" className="hidden sm:inline hover:text-slate-700 transition-colors">✉️ radek@yarotravel.cz</a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Naše golfové hotely</h1>
          <p className="mt-2 text-slate-500">Vyberte si z naší nabídky prověřených hotelů pro váš golfový zájezd</p>
        </div>

        {hotels.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Žádné hotely k zobrazení</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <Link
                key={hotel.id}
                to={hotel.slug ? `/hotely/${hotel.slug}` : "#"}
                className="group rounded-2xl overflow-hidden bg-white shadow-md border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Image */}
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  {hotel.images[0] ? (
                    <img
                      src={hotel.images[0]}
                      alt={hotel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      Bez fotky
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-2">
                <h2 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                    {hotel.name}
                  </h2>
                  {hotel.subtitle && (
                    <p className="text-sm text-slate-500 line-clamp-2">{hotel.subtitle}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                    {hotel.nights && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">🌙 {hotel.nights}</span>
                    )}
                    {hotel.golf_courses && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">⛳ {hotel.golf_courses}</span>
                    )}
                  </div>
                  {hotel.price_label && (
                    <p className="text-sm font-semibold text-blue-700 pt-1">{hotel.price_label}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center space-y-2">
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
