
## Chytré vyhledávací pole s inline přidáváním

### Co se změní

Vyhledávací pole na čtyřech stránkách (Hotely, Destinace, Dodavatelé, Klienti) se přemění na inteligentní vstup: pokud hledaný výraz **neodpovídá** žádnému záznamu, zobrazí se přímo pod polem nabídka „+ Přidat [zadaný text]". Kliknutím se rovnou otevře formulář pro nový záznam s předvyplněným názvem. Tlačítko „Přidat ..." v nástrojové liště (toolbar) se odstraní.

---

### Chování pro každou sekci

**Hotely**
- Pokud zadaný text nenajde shodu → pod polem se zobrazí `+ Přidat hotel „[text]"`
- Kliknutí otevře stávající dialog „Nový hotel" s předvyplněným názvem
- Tlačítko „Přidat hotel" v toolbaru se odebere

**Dodavatelé**
- Pokud zadaný text nenajde shodu → `+ Přidat dodavatele „[text]"`
- Kliknutí otevře dialog s předvyplněným názvem
- Tlačítko „Přidat" v toolbaru se odebere

**Klienti**
- Pokud zadaný text nenajde shodu → `+ Přidat klienta „[text]"`
- Text se interpretuje jako „Jméno Příjmení" a předvyplní příslušná pole
- Tlačítko „Nový zákazník" se odebere (ostatní tlačítka – Import, Skenovat – zůstanou)

**Destinace** (nejsložitější)
- Pokud zadaný text nenajde shodu → `+ Přidat destinaci „[text]"`
- Kliknutí spustí **automatické dohledání země** z lokální mapy (COUNTRY_DATA + vlastní tabulka destinací → zemí)
  - Příklad: „Vídeň" → Rakousko (předdefinovaná mapa destinace→země)
  - Pokud je země nalezena automaticky, zobrazí se potvrzovací dialog s předvyplněnou zemí, kterou lze změnit
  - Pokud zemi nelze odvodit, dialog se zeptá na výběr ze seznamu zemí
- Tlačítko „Nová destinace" se odebere

---

### Technická realizace

**1. Nová mapa destinací → zemí (`src/lib/destinationCountryMap.ts`)**

Slovník ~100 nejčastějších golfových destinací v češtině mapující název destinace na název země v databázi:
```typescript
export const DESTINATION_COUNTRY_MAP: Record<string, string> = {
  "vídeň": "Rakousko",
  "antalya": "Turecko",
  "istanbul": "Turecko",
  "mallorca": "Španělsko",
  "costa del sol": "Španělsko",
  // ... atd.
};
```

**2. Nová sdílená komponenta `src/components/SmartSearchInput.tsx`**

Wrapper kolem `Input` který:
- Vykreslí standardní vyhledávací pole
- Pokud `searchText` neprázdný a `noResults === true` → zobrazí pod polem dropdown s tlačítkem „+ Přidat..."
- Přijme `onAddNew(text: string)` callback

**3. Úpravy jednotlivých stránek**

| Soubor | Změna |
|---|---|
| `src/pages/Hotels.tsx` | Nahradit Input za SmartSearchInput, odstranit toolbar „Přidat hotel", napojit `onAddNew` na stávající `handleCreate` |
| `src/pages/Suppliers.tsx` | Stejný pattern, předvyplnit název v dialog formData |
| `src/pages/Clients.tsx` | Předvyplnit first_name/last_name z textu (split na první mezeru) |
| `src/pages/Destinations.tsx` | Přidat logiku dohledání země + potvrzovací/výběrový dialog |

**4. Dialog pro Destinace**

Místo okamžitého uložení se otevře dialog:
```
Nová destinace: „Vídeň"
Navrhovaná země: [Rakousko ▾]   ← pokud nalezena automaticky
             nebo
Vyberte zemi: [rozbalovací seznam všech zemí]
[Zrušit]  [Přidat destinaci]
```

---

### Co se nemění

- Existující dialogy pro editaci (Upravit hotel, Upravit dodavatele, atd.) zůstávají beze změny
- Ostatní tlačítka v toolbaru Klientů (Import z textu, Skenovat doklad, Duplicity) zůstávají
- BulkSupplierUpload v toolbaru Dodavatelů zůstává
- Žádné změny databáze nejsou nutné

---

### Pořadí implementace

1. Vytvořit `src/lib/destinationCountryMap.ts` se slovníkem destinací
2. Vytvořit `src/components/SmartSearchInput.tsx`
3. Upravit `src/pages/Hotels.tsx`
4. Upravit `src/pages/Suppliers.tsx`
5. Upravit `src/pages/Clients.tsx`
6. Upravit `src/pages/Destinations.tsx` (nejsložitější – dialog s výběrem země)
