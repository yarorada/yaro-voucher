
## Oprava zobrazení názvu obchodního případu v přehledu

### Požadovaný formát

```text
Objednatel • ISO • Hotel • Datum (Objednatel)
```

- **Primární jméno** = vždy objednatel (`lead_client_id` → join na `clients`)
- **Závorka** = objednatel se přidá do závorky NA KONCI, pokud **není přítomen v `deal_travelers`** (tj. má odškrtnuto, že není 1. cestujícím)
- Pokud je objednatel v `deal_travelers`, závorka se nezobrazí vůbec

### Analýza aktuálního stavu

V `src/pages/Deals.tsx` (řádky 493–541):

- Aktuálně se jako primární jméno bere **1. cestující** (`firstByOrder`)
- Závorka se zobrazuje pokud se objednatel liší od 1. cestujícího — to je špatně

### Technické změny

**`src/pages/Deals.tsx`** (pouze logika sestavení `displayDesc`):

1. **Primární jméno** = objednatel:
   - Pokud je `ordererInTravelers` (je v `deal_travelers` s `is_lead_traveler=true`) → použít jeho jméno
   - Jinak použít `lead_client` (join přes `lead_client_id`)
   - Fallback na `firstByOrder?.clients` pokud ani jedno není dostupné

2. **Závorka** = zobrazit pouze pokud objednatel **není** v `deal_travelers`:
   - `!ordererInTravelers && deal.lead_client_id` → přidat `(Jméno Příjmení)` na konec

### Výsledné chování

| Situace | Zobrazení |
|---|---|
| Objednatel = 1. cestující (checkbox zaškrtnut) | `Pavel Kadlic • TUR • Hotel • 03-03-26` |
| Objednatel není cestující (odškrtnuto) | `Pavel Kadlic • TUR • Hotel • 03-03-26 (Pavel Kadlic)` |

Poznámka: V druhém případě se objednatel zobrazí i v závorce, protože není v seznamu cestujících — to je záměrné chování dle zadání.

### Soubory k úpravě

- **`src/pages/Deals.tsx`** — úprava logiky sestavení `displayDesc` (řádky ~520–541), žádné změny v databázi ani dotazech
