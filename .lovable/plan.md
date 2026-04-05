## Plan: Zobrazení zdrojů u nalezených fotek

### Co se změní

Scraper aktuálně vrací jeden pole `hotelImages` bez informace o zdroji. Upravíme scraper i UI tak, aby se fotky zobrazovaly ve 4 kategoriích:

- **🌐 Web hotelu** — fotky z oficiálního webu
- **📘 Booking.com** — fotky z [Booking.com](http://Booking.com) (vyber jich minimalne 20)
- **🦉 TripAdvisor** — fotky z TripAdvisoru (nový zdroj)
- **🔍 Obecné hledání** — fallback z obecného vyhledávání

### Změny v souborech

**1. `supabase/functions/scrape-hotel-images/index.ts**`

- Místo jednoho pole `hotelImages` vracet objekt se 4 poli: `websiteImages`, `bookingImages`, `tripadvisorImages`, `generalImages`
- Přidat novou PHASE pro TripAdvisor: `site:tripadvisor.com "{hotelName}"` (podobně jako Booking.com)
- Každá fáze ukládá do svého pole
- Response formát:
  &nbsp;

```json
{
  "success": true,
  "websiteImages": [...],
  "bookingImages": [...],
  "tripadvisorImages": [...],
  "generalImages": [...],
  "golfImages": [...],
  "detectedWebsiteUrl": "..."
}
```

**2. `src/components/HotelImageUpload.tsx**`

- Aktualizovat state `foundImages` na novou strukturu: `{ website: string[], booking: string[], tripadvisor: string[], general: string[], golf: string[], search: string[] }`
- Zobrazit 4+2 sekcí v pickeru místo současných 3 (hotel/golf/search)
- Zachovat zpětnou kompatibilitu s `search` (z Perplexity)
- Aktualizovat `handleAutoFill` a metadata probing pro novou strukturu

### Technické detaily

Scraper — nová fáze TripAdvisor (mezi Phase 2 a 3):

```
firecrawlSearch(`site:tripadvisor.com "${hotelName}" hotel`, 2)
→ filtrovat URL obsahující "tripadvisor" nebo "tacdn"
```

UI sekce v pickeru:

```
🌐 Web hotelu (N)        — websiteImages
📘 Booking.com (N)       — bookingImages  
🦉 TripAdvisor (N)       — tripadvisorImages
🔍 Obecné hledání (N)    — generalImages
⛳ Golf (N)              — golfImages
🔍 Další z vyhledávání (N) — search (Perplexity)
```