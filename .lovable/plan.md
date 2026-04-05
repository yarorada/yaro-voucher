

## Plan: Oprava chyb ve veřejné nabídce

### Identifikované problémy (ze screenshotu)

1. **Délka hřišť ukazuje "NaN"** — pole `length` v `golf_courses_data` je uloženo jako string (např. `"6 600"`) a `Number("6 600")` vrací NaN
2. **Chybí počet jamek u názvu hřiště** — v tabulce i v "Cena zahrnuje" by měl být za názvem v závorce počet jamek (18/9)
3. **"4× green fee" → "4 green fee"** — odstranit symbol ×
4. **U green fee chybí názvy hřišť z tee times** — tee times jsou na dealu (`deal.tee_times`), ale API je nepředává do public offer; golf service `description` je prázdné
5. **Cena na osobu se zobrazuje 2× duplicitně** (4 řádky místo 2) — při více hotelových službách se generují duplicitní záznamy
6. **Zkrátit popisky** — "Cena za osobu v jednolůžkovém pokoji" → "Jednolůžkový pokoj (os.)"
7. **Špatný výpočet součtové ceny** — chybí správná deduplikace per-person řádků

### Změny

**A. Edge funkce `get-public-offer/index.ts`**
- Přidat `tee_times` do selectu z tabulky `deals` (řádek 64)
- Předat `tee_times` do JSON response jako `deal.tee_times`

**B. `src/pages/PublicOffer.tsx`**

1. **Fix NaN v délce hřišť** — `parseLength` funkce: odstranit mezery ze stringu před `Number()` (`"6 600"` → `6600`)

2. **Přidat počet jamek za název** — golf_courses_data obsahuje pole (pravděpodobně `par` nebo `holes`). Pokud existuje `holes`, zobrazit `"Golf Bogliaco (18)"`. Pokud ne, odvodit z PAR (PAR 72 = 18 jamek, PAR 36 = 9 jamek)

3. **Green fee text** — `{totalGreenFees}× green fee` → `{totalGreenFees} green fee`

4. **Názvy hřišť z tee times** — přidat `deal.tee_times` do OfferData interface; v VariantCard/DirectServicesCard použít `tee_times` k extrakci názvů hřišť (`tt.club`), spojit unique názvy do závorky za "4 green fee"

5. **Deduplikace per-person řádků** — v `computePerPersonPrices`: po vygenerování všech lines, deduplikovat podle `personCount` (vzít průměr nebo součet dle logiky). Při více hotelech se stejnou obsazeností sečíst hotelové ceny

6. **Zkrácení popisků** — `getPerPersonPriceLabel(1)` → `"Jednolůžkový pokoj (os.)"`, `getPerPersonPriceLabel(2)` → `"Dvoulůžkový pokoj (os.)"`

### Soubory k úpravě
- `supabase/functions/get-public-offer/index.ts` — přidat tee_times do query a response
- `src/pages/PublicOffer.tsx` — všechny UI a výpočetní opravy

### Technické detaily

```text
parseLength("6 600")  → 6600  (strip spaces/non-breaking spaces)
parseLength(6600)     → 6600
parseLength(null)     → null

getPerPersonPriceLabel(1) → "Jednolůžkový pokoj (os.)"
getPerPersonPriceLabel(2) → "Dvoulůžkový pokoj (os.)"

Deduplikace:
  Map<personCount, { sum hotel prices, count }>
  → pro každý personCount: hotelPP = totalHotelPrice / personCount + nonHotelPerPerson
  → výsledek: max 2 řádky (single + double)

Tee times data: deal.tee_times = [{ date, club, time, golfers }]
  → unique club names → "(Golf Bogliaco, Gardagolf CC)"
```

