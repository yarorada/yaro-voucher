
## Plan: Filtry a kategorizace hotelů podle zemí a destinací

### Co chceme dosáhnout
Na stránce `/hotels` přidat přehlednou navigaci pro filtrování hotelů podle **země** a **destinace** — data jsou již v databázi (sloučen z relace `destinations → countries`).

### Přístup: Tabs podle zemí + sub-filtr destinací

```text
[ Všechny (24) ]  [ Španělsko (8) ]  [ Portugalsko (6) ]  [ Skotsko (5) ]  ...

  Destinace: [ Všechny ]  [ Costa del Sol ]  [ Algarve ]  [ Andaluzie ]

  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │   Hotel 1   │  │   Hotel 2   │  │   Hotel 3   │
  └─────────────┘  └─────────────┘  └─────────────┘
```

### Změny v kódu (pouze `src/pages/Hotels.tsx`)

1. **Nový state** `selectedCountry: string | null` a `selectedDestination: string | null`

2. **Výpočet unikátních zemí** z načtených hotelů — seřazené podle počtu hotelů (nejvíce nahoře):
   ```ts
   const countries = useMemo(() => {
     const map = new Map<string, { name, count }>()
     hotels.forEach(h => {
       const c = h.destinations?.countries?.name
       if (c) map.set(c, { name: c, count: (map.get(c)?.count ?? 0) + 1 })
     })
     return [...map.values()].sort((a, b) => b.count - a.count)
   }, [hotels])
   ```

3. **Výpočet destinací** filtrovaných podle vybrané země (zobrazí se jen pokud je vybraná konkrétní země)

4. **Rozšíření filtrace** — na search přidáme i filtr podle vybrané země/destinace:
   ```ts
   const filtered = hotels.filter(h => {
     if (!matchesSearch(h)) return false
     if (selectedCountry && h.destinations?.countries?.name !== selectedCountry) return false
     if (selectedDestination && h.destinations?.name !== selectedDestination) return false
     return true
   })
   ```

5. **UI — tabs/chip-bary** přidané mezi nadpis a grid:
   - **Řada 1 – Země**: scrollovatelné chipy (Badge-like) s počtem hotelů. Klik na již vybranou → zruší filtr.
   - **Řada 2 – Destinace**: zobrazí se jen pokud je vybraná země a má více než 1 destinaci. Zruší se při změně země.
   - Hotely bez destinace → zobrazí se pod filtr "Bez destinace" nebo vždy při "Všechny"

6. Výběr nové země automaticky resetuje filtr destinací

### Rozsah změn
- Pouze `src/pages/Hotels.tsx` — žádné DB migrace, žádné nové komponenty
- Čisté čtení již načtených dat, nulový dopad na výkon
