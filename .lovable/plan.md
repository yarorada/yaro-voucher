

## Plan: Vylepšení stahování a nahrávání fotek hotelů

### Současné problémy
- Scraper často stahuje thumbnaily a malé verze obrázků místo plného rozlišení
- Některé obrázky se nenačtou (CORS, hotlink ochrana, mrtvé URL)
- Není vidět rozlišení/velikost obrázku před výběrem
- Nelze snadno naplnit všechny sloty najednou

### Co se změní

**1. Lepší extrakce velkých obrázků v Edge funkci `scrape-hotel-images`**
- Přidat rozpoznávání URL vzorů pro vysoké rozlišení (Booking.com `max1280x900` → `max1920x1080`, WordPress `-150x150` → originál)
- Extrahovat `data-original`, `data-lazy-src`, `data-hi-res` atributy
- Z `srcset` brát vždy největší variantu (podle `w` deskriptoru)
- Přidat filtr na minimální rozměry v URL (vyhodit explicitně malé jako `_thumb`, `_small`, `100x100`)

**2. Ověření kvality obrázků přes proxy (nový endpoint)**
- Rozšířit `proxy-image` o mode `head-only` — vrátí pouze rozměry a velikost souboru bez stahování celého obrázku
- Ve výběru fotek zobrazit rozměry a velikost u každé fotky
- Barevně označit kvalitu: zelená (≥1200px), žlutá (800–1200px), červená (<800px)

**3. Automatické naplnění slotů ("Auto-fill")**
- Nové tlačítko "Automaticky vyplnit" v pickeru
- Vybere N nejlepších obrázků (podle rozlišení/velikosti) a přiřadí je do prázdných slotů
- Stáhne a uloží je paralelně

**4. UX vylepšení pickeru**
- Zobrazit rozlišení a velikost souboru pod každou fotkou
- Přidat možnost označit více fotek najednou (checkbox mód) a uložit hromadně
- Přidat řazení fotek podle kvality (největší první)

### Soubory k úpravě
- `supabase/functions/scrape-hotel-images/index.ts` — vylepšení URL extrakce
- `supabase/functions/proxy-image/index.ts` — přidat head-only mód
- `src/components/HotelImageUpload.tsx` — UI: auto-fill, rozměry, multi-select

### Technické detaily

**URL upgrade patterns (scraper):**
```text
Booking.com: /max500/ → /max1920x1080/
WordPress:   -150x150.jpg → .jpg (strip dimensions)
Cloudinary:  /w_400/ → /w_1920,q_auto/
General:     _thumb, _small → strip suffix
srcset:      pick highest "w" descriptor
```

**Head-only proxy response:**
```json
{ "width": 1920, "height": 1080, "size": 524288, "contentType": "image/jpeg" }
```

**Auto-fill logic:**
1. Seřadit nalezené fotky podle sizeScore (URL hints) + skutečné velikosti
2. Vzít top N (= počet prázdných slotů)
3. Stáhnout přes proxy → ensureMinimumQuality → upload → uložit do DB

