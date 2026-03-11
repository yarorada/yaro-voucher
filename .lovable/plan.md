
## Plan: Převod sekcí Detailu obchodního případu na záložky (Tabs)

### Současný stav
Stránka `src/pages/DealDetail.tsx` (~3606 řádků) zobrazuje vše na jedné stránce ve vertikálním scrollu. Sekce jsou:
1. **Základní informace** (Karta, řádky 2662–2793)
2. **Cestující + Platební kalendář** (Grid 2/2, řádky 2795–2904)
3. **Rooming list** (`DealRoomingList`, řádek 2906)
4. **Varianty** (`DealVariants`, řádky 2908–2912)
5. **Odpověď klienta** (`ClientOfferResponseCard`, řádek 2915)
6. **Služby** (Karta se službami a Tee Times, řádky 2917–3433)
7. **Cestovní dokumenty** (`DealDocumentsSection`, řádky 3435–3449)
8. **Doklady dodavatelům** (`DealSupplierInvoices`, řádek 3452)

### Návrh záložek

```text
[Základní info] [Cestující] [Platební kalendář] [Služby] [Dokumenty]
```

- **Základní info** — původní karta + Varianty + Odpověď klienta
- **Cestující** — tabulka cestujících + Rooming list
- **Platební kalendář** — `DealPaymentSchedule`
- **Služby** — tabulka služeb + Tee Times editor
- **Dokumenty** — `DealDocumentsSection` + `DealSupplierInvoices`

### Implementace

**Soubor**: `src/pages/DealDetail.tsx`

1. Přidat import `Tabs, TabsList, TabsTrigger, TabsContent` z `@/components/ui/tabs`
2. Obalit sekce pod `<header>` do `<Tabs defaultValue="info">` místo `<div className="space-y-6">`
3. Přidat `<TabsList>` s 5 záložkami:
   - `info` → Základní informace
   - `travelers` → Cestující
   - `payments` → Platební kalendář
   - `services` → Služby
   - `documents` → Dokumenty
4. Každou sekci obalit příslušným `<TabsContent value="...">`

### URL state (volitelně)
Záložky budou pouze UI state (React state / výchozí hodnota). Není potřeba URL parametr – zachová se jednoduchost.

### Co se nemění
- Hlavička stránky (název, badge, toolbar tlačítka) zůstává nad záložkami
- Všechny dialogy, modaly a logika zůstávají beze změny
- Záložky jsou plné šířky, vizuálně konzistentní s existujícím designem

### Rozsah změn
Pouze soubor `src/pages/DealDetail.tsx` – pouze JSX struktura od řádku ~2660 do ~3453. Žádné změny v logice, hooky ani backend.
