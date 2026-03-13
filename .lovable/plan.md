
## Reformatování sekce "Cena zahrnuje"

### Co se mění

**Sekce "Cena zahrnuje"** v kartě varianty (a přímých služeb) přestane zobrazovat každou službu jako samostatný řádek a místo toho:

1. **Hotel řádek** → `{N} nocí — ubytování v hotelu {hotel_name}, {description}` kde N = počet nocí z dat varianty (end - start), description = stravování (polopenze apod.)
2. **Golf řádek** → `{X}× green fee` kde X = součet `quantity` všech golf služeb v dané variantě/kolekci (pokud golf > 0)
3. **Ostatní služby** (let, transfer, pojištění, strava, other) → beze změny, jako nyní

### Soubory ke změně

**1. `src/pages/PublicOffer.tsx`**

- V `VariantCard` — upravit sekci `{/* Services */}` (řádky ~656–680): přidat helper `renderIncludesSection(services, startDate, endDate)` který:
  - Najde hotelovou službu, spočítá počet nocí z `variant.start_date` / `variant.end_date`
  - Vypočítá součet green fee z golf služeb (sum of `.quantity`)
  - Ostatní služby renderuje jako dosud
  - Hotel a golf zobrazí jako nové formátované řádky
- Stejná logika v `DirectServicesCard` (řádky ~782–805)

**2. `supabase/functions/send-offer-email/index.ts`**

- Upravit `renderServiceLine()` resp. přidat helper `renderIncludesHtml(services, startDate, endDate)`:
  - Stejná logika — noci z dat, golf sečíst
  - Hotel → `🏨 **{N} nocí — ubytování v hotelu {hotel_name}, {description}**`
  - Golf → `⛳ **{X}× green fee**`
  - Ostatní beze změny
- Použít nový helper v `renderVariantCard()` místo `vServices.map(renderServiceLine)`
- Totéž v direct services sekci

### Logika výpočtu nocí

```text
Pokud varianta má start_date a end_date:
  nights = daysBetween(start_date, end_date)  // např. 7
  label = "7 nocí — ubytování v hotelu Costa del Sol, polopenze"
Pokud hotel má jen vlastní start/end (a varianta nemá):
  použít service start/end
Pokud žádná data nejsou:
  label = "ubytování v hotelu {hotel_name}" (bez nocí)
```

### Logika sečtení green fee

```text
const totalGreenFees = services
  .filter(s => s.service_type === 'golf')
  .reduce((sum, s) => sum + (s.quantity || 1), 0);
// Zobrazit pouze pokud totalGreenFees > 0: "{totalGreenFees}× green fee"
```

### Výsledný formát na veřejné nabídce

```text
Cena zahrnuje
🏨  7 nocí — ubytování v hotelu Costa del Sol, polopenze
⛳  4× green fee
✈️  Praha → Málaga · 10.7. · FR8102  [let beze změny]
🚗  Transfer letiště ↔ hotel  [transfer beze změny]
```

### Scopě změn

- `src/pages/PublicOffer.tsx` — `VariantCard` + `DirectServicesCard`
- `supabase/functions/send-offer-email/index.ts` — `renderVariantCard` + direct services sekce
- Žádné databázové změny
