

## Oprava: hotel per_person přiřazovat podle person_count

### Problém
Na řádcích 329–331 se u hotelu s `per_person` režimem přidává cena do **obou** bucketů (jednolůžkový i dvoulůžkový). Tedy hotel pro 2 osoby (person_count=2) se chybně započítá i do jednolůžkového pokoje a naopak.

### Oprava
**Soubor:** `src/pages/PublicOffer.tsx`, řádky 329–331

Nahradit:
```typescript
if (priceMode === "per_person") {
  hotelPriceMap.set(1, (hotelPriceMap.get(1) || 0) + hotelPrice);
  hotelPriceMap.set(2, (hotelPriceMap.get(2) || 0) + hotelPrice);
}
```

Za:
```typescript
if (priceMode === "per_person") {
  // Cena je za osobu – přiřaď do bucketu podle skutečného person_count služby
  const pc = h.person_count || 1;
  const occupancy = h.quantity && h.quantity > 0 ? Math.round(pc / h.quantity) : pc;
  hotelPriceMap.set(occupancy, (hotelPriceMap.get(occupancy) || 0) + hotelPrice);
}
```

Tím se hotel s 2 osobami / 1 pokoj přiřadí jen do dvoulůžkového bucketu a hotel s 1 osobou / 1 pokoj jen do jednolůžkového.

### Výsledek pro deal 260034
- Jednolůžkový: 15 600 + 9 850 = **25 450 CZK**
- Dvoulůžkový: 8 000 + 9 850 = **17 850 CZK**

### Rozsah
3 řádky v jednom souboru.

