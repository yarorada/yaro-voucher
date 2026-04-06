

## Oprava výpočtu ceny na osobu ve veřejné nabídce

### Problém

Aktuální logika v `computePerPersonPrices` u ne-hotelových služeb přičítá **pouze** služby s režimem `per_person` a zcela ignoruje služby s režimem `per_service`. To znamená, že např. transfery nebo jiné služby oceněné za celek se do ceny na osobu vůbec nezapočítají.

### Nová logika

**Soubor:** `src/pages/PublicOffer.tsx` — funkce `computePerPersonPrices`

Změna výpočtu `nonHotelPerPersonTotal`:

- **per_person** → přičti `price` přímo (cena je už za osobu)
- **per_service** → přičti `price / person_count` (celková cena služby vydělená počtem účastníků)

**Hotel:**
- **per_person** → cena je už za osobu, použij přímo pro jednolůžkový i dvoulůžkový
- **per_service** → jednolůžkový = celá cena; dvoulůžkový = cena / 2

(Tato hotelová logika je již správně implementována, mění se pouze ne-hotelová část.)

### Konkrétní změna

Řádky 283–286 — nahradit reduce tak, aby u `per_service` služeb dělil cenu počtem osob (`person_count`):

```typescript
const nonHotelPerPersonTotal = nonHotels.reduce((sum, s) => {
  const price = s.price || 0;
  if (price <= 0) return sum;
  const priceMode = s.details?.price_mode || "per_service";
  if (priceMode === "per_person") {
    return sum + price;
  } else {
    // per_service: rozděl cenu na počet účastníků
    const persons = s.person_count || 1;
    return sum + price / persons;
  }
}, 0);
```

### Rozsah

Jedna změna v jednom souboru (`src/pages/PublicOffer.tsx`), cca 5 řádků.

