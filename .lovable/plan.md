
## Přidání sekce zavazadel do dialogu letu

### Co se změní

**1. `FlightFormData` interface (`src/components/FlightSegmentForm.tsx`)**
Přidám nové pole `baggage` do interface `FlightFormData`:
```typescript
baggage?: {
  cabin_bag_kg?: number;       // taška na palubu (notebook bag)
  hand_luggage_kg?: number;    // palubní zavazadlo (kabinový kufr na kolečkách)
  checked_luggage_kg?: number; // odbavené zavazadlo (kufr)
}
```

**2. Grafická sekce zavazadel ve `FlightSegmentForm` (`src/components/FlightSegmentForm.tsx`)**
Pod segmenty letů přidám vizuálně zvýrazněnou sekci "Zavazadla" se třemi kartičkami, každá s ikonou a vstupem na kilogramy:

- **Taška na palubu** – ikona `Briefcase` (taška na notebook) – pole pro kg
- **Palubní zavazadlo** – ikona `Luggage` (kufr na kolečkách) – pole pro kg
- **Odbavené zavazadlo** – ikona kufru (`Package` nebo podobná) – pole pro kg

Kartičky budou graficky zvýrazněné (border + barevný bg), s ikonou, názvem a vstupním polem pro kilogramy. Pole bude nepovinné – nevyplněné = neomezeno/nezahrnuto.

**3. Propagace dat přes dialogy**

- **`VariantServiceDialog.tsx`** – přidám state `baggage` a propaguji do `FlightSegmentForm` a do `flightDetails` při ukládání.
- **`DealDetail.tsx`** – stejně přidám `baggage` do `flightFormData` a ukládání.

**4. Zobrazení v PDF smlouvě (`src/components/ContractPdfTemplate.tsx`)**
Pod sekci "Itinerář cesty – letecká přeprava" přidám řádek se zavazadly z `flight.details.baggage`. Formát:
```
Zavazadla: Taška na palubu: 8 kg · Palubní zavazadlo: 10 kg · Odbavené zavazadlo: 23 kg
```
Zobrazí se pouze pokud je alespoň jedna hodnota vyplněna.

---

### Technické detaily

#### `FlightSegmentForm.tsx` – nová sekce zavazadel
```tsx
{/* Zavazadla */}
<div className="p-4 border rounded-lg bg-blue-50/30 dark:bg-blue-950/20 space-y-2">
  <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
    <Luggage className="h-4 w-4" /> Zavazadla
  </div>
  <div className="grid grid-cols-3 gap-3">
    {/* Taška na palubu */}
    <div className="flex flex-col items-center gap-1 p-2 border rounded bg-background">
      <Briefcase className="h-6 w-6 text-slate-500" />
      <span className="text-xs text-center">Taška na palubu</span>
      <div className="flex items-center gap-1">
        <Input type="number" value={...} className="w-16 h-7 text-center text-xs" />
        <span className="text-xs">kg</span>
      </div>
    </div>
    {/* Palubní zavazadlo */}
    ...
    {/* Odbavené zavazadlo */}
    ...
  </div>
</div>
```

#### Ukládání do DB
Data se ukládají jako součást `details` JSONB pole – `details.baggage` – žádná změna DB schématu není potřeba.

#### PDF smlouva
```tsx
{/* Pod itinerářem letů */}
{(() => {
  const b = flight.details?.baggage;
  if (!b || (!b.cabin_bag_kg && !b.hand_luggage_kg && !b.checked_luggage_kg)) return null;
  const parts = [];
  if (b.cabin_bag_kg) parts.push(`Taška na palubu: ${b.cabin_bag_kg} kg`);
  if (b.hand_luggage_kg) parts.push(`Palubní zavazadlo: ${b.hand_luggage_kg} kg`);
  if (b.checked_luggage_kg) parts.push(`Odbavené zavazadlo: ${b.checked_luggage_kg} kg`);
  return <p style={{fontSize: '9px', margin: '2px 0', color: '#555'}}>Zavazadla: {parts.join(' · ')}</p>;
})()}
```

### Soubory ke změně
1. `src/components/FlightSegmentForm.tsx` – přidat `baggage` do interface a grafickou UI sekci
2. `src/components/VariantServiceDialog.tsx` – přidat baggage state a propagaci
3. `src/pages/DealDetail.tsx` – přidat baggage do flightFormData a ukládání
4. `src/components/ContractPdfTemplate.tsx` – zobrazit zavazadla pod itinerářem
