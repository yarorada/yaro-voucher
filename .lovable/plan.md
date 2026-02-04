

# Plán: Vyhledávání letů podle data a routingu

## Přehled

Přidáme novou funkci do dialogu služeb, která umožní automatické vyhledání letů na základě zadaného data a trasy (odkud-kam). Systém vrátí dostupné lety s časy odletu/příletu, čísly letů a leteckými společnostmi.

## Uživatelské rozhraní

Nový workflow pro uživatele:
1. Vybere typ služby "Letenka"
2. Zadá odkud, kam a datum
3. Klikne na tlačítko "Vyhledat lety"
4. Zobrazí se seznam dostupných letů
5. Vybere požadovaný let - data se automaticky doplní do formuláře

## Technické řešení

### 1. Nová edge funkce `search-flight-schedules`

Vytvoříme backend funkci, která:
- Přijme parametry: departure airport, arrival airport, date, adults count
- Zavolá Amadeus Flight Offers API
- Vrátí seznam letů s detaily (časy, čísla letů, letecké společnosti, ceny)

```text
Request:
POST /search-flight-schedules
{
  "origin": "PRG",
  "destination": "BKK",
  "departure_date": "2026-03-15",
  "adults": 2
}

Response:
{
  "flights": [
    {
      "segments": [
        {
          "departure_airport": "PRG",
          "arrival_airport": "DOH",
          "departure_time": "14:55",
          "arrival_time": "22:40",
          "airline_code": "QR",
          "airline_name": "Qatar Airways",
          "flight_number": "QR292",
          "date": "2026-03-15"
        },
        {
          "departure_airport": "DOH",
          "arrival_airport": "BKK",
          "departure_time": "01:40",
          "arrival_time": "12:15",
          "airline_code": "QR",
          "airline_name": "Qatar Airways",
          "flight_number": "QR834",
          "date": "2026-03-16"
        }
      ],
      "total_duration": "PT21H20M",
      "price": 15600
    }
  ]
}
```

### 2. Úprava VariantServiceDialog.tsx

Přidáme:
- Tlačítko "Vyhledat lety" vedle polí pro výběr letišť
- Dialog/dropdown se seznamem nalezených letů
- Automatické vyplnění všech segmentů po výběru letu

### 3. Konfigurace API klíčů

Amadeus API vyžaduje:
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

Tyto je potřeba přidat jako secrets do projektu.

## Struktura souborů

```text
Nové soubory:
├── supabase/functions/search-flight-schedules/index.ts

Upravené soubory:
├── src/components/VariantServiceDialog.tsx
│   └── Přidání vyhledávacího UI
```

## Omezení a alternativy

### Amadeus API Free Tier
- 2000 požadavků měsíčně zdarma
- Testovací data (ne vždy aktuální)
- Pro produkci nutná aktivace

### Alternativní přístup bez API
Pokud nechcete používat externí API, můžeme rozšířit stávající AI import:
- Uživatel vloží jen routing a datum
- AI vyhledá typické časy pro danou trasu na internetu
- Méně přesné, ale bez nutnosti API klíče

## Další kroky

1. Rozhodnout, zda použít Amadeus API nebo alternativní AI přístup
2. Pokud Amadeus: registrace na developers.amadeus.com (zdarma)
3. Implementace edge funkce
4. Integrace do UI

