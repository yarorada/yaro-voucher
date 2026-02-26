
## Úprava sekce zavazadel v dialogu letu a PDF smlouvě

### Co se změní

---

### 1. Nová datová struktura zavazadel (`FlightSegmentForm.tsx`)

Každý typ zavazadla bude mít dvě hodnoty:
- `included: boolean` – zaškrtávátko „v ceně"
- `kg?: number` – volitelný váhový limit

Nová struktura `baggage`:
```typescript
baggage?: {
  cabin_bag?: { included: boolean; kg?: number };
  hand_luggage?: { included: boolean; kg?: number };
  checked_luggage?: { included: boolean; kg?: number };
  golf_bag?: { included: boolean; kg?: number };
}
```

> Původní flat struktura (`cabin_bag_kg`, `hand_luggage_kg`, ...) bude nahrazena. Stávající data uložená ve starém formátu zůstanou bezpečně ignorována (nová pole budou prázdná).

---

### 2. Redesign UI sekce zavazadel (`FlightSegmentForm.tsx`)

Každá karta zavazadla bude mít:
- Ikonu nahoře
- Název
- Zaškrtávátko s textem „V ceně" (pokud není zaškrtnuto, pole pro kg je skryté/neaktivní)
- Pole pro kg (zobrazí se jen pokud je zaškrtnuto `included`)

Vizuálně: zaškrtnutá karta bude zvýrazněna (např. modrý rámeček), nezaškrtnutá zůstane šedá.

---

### 3. Oprava zobrazení v PDF smlouvě (`ContractPdfTemplate.tsx`)

**Problém:** Zavazadla se zobrazují pouze pokud `legs.length > 0` — ale kód pro zavazadla je vnořen dovnitř tohoto bloku a musí správně přistupovat k datům v novém formátu.

**Oprava:**
- Zavazadla se vždy zobrazí pod itinerářem letu (ať jsou segmenty nebo ne)
- Aktualizovat logiku čtení z nového formátu `cabin_bag.included` / `cabin_bag.kg`
- Formát textu:
  - Pokud `included = true` a `kg` je zadáno: `💼 Taška na palubu 8 kg`
  - Pokud `included = true` a `kg` není zadáno: `💼 Taška na palubu (v ceně)`
  - Pokud `included = false`: nezobrazovat

---

### Soubory ke změně

1. **`src/components/FlightSegmentForm.tsx`** – nová datová struktura baggage + redesign UI karet se zaškrtávátky
2. **`src/components/ContractPdfTemplate.tsx`** – oprava čtení nového formátu a zobrazení pod itinerářem

---

### Technické detaily UI karty

```
┌─────────────────────┐
│       💼            │
│  Taška na palubu    │
│  ☑ V ceně           │
│  [  8  ] kg         │  ← zobrazí se jen pokud ☑
└─────────────────────┘
```

Karta bez zaškrtnutí:
```
┌─────────────────────┐   (šedý rámeček)
│       💼            │
│  Taška na palubu    │
│  ☐ V ceně           │
└─────────────────────┘
```
