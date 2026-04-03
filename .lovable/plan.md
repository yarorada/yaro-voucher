

# Plán: Optimalizace rozložení finančních metrik v sekci Základní informace

## Současný stav
Řádky 2871–2993: Layout je `flex-col md:flex-row` — vlevo formulářová pole (grid 3 sloupce), vpravo úzký panel 48px (`md:w-48`) s Prodejní cenou, Nákupní cenou a Ziskem oddělený bordrem. Na mobilu se panel zobrazuje pod formulářem přes celou šířku.

**Problém**: Na desktopu panel zabírá pravou část, ale je příliš úzký a vytváří nerovnoměrný layout. Na iPadu a mobilu je rozložení neoptimální.

## Nové rozložení

### Desktop (md+)
Dvousloupcový grid: levý sloupec = Stav + Objednatel + Destinace (pod sebou, plná šířka), pravý sloupec = finanční panel (Prodejní cena, Nákupní cena, Zisk) v kartě/boxu s jemným pozadím.

```text
┌────────────────────────────────┬──────────────────────┐
│ Stav         [Select ▼]       │  Prodejní   123 000  │
│ Objednatel   [Combobox]       │  Nákupní     98 000  │
│  ☐ Je prvním cestujícím       │  Zisk     ✓  25 000  │
│ Destinace    [Combobox      ] │                      │
├────────────────────────────────┴──────────────────────┤
│ Hotel / Datum / Poznámky (plná šířka)                │
└──────────────────────────────────────────────────────┘
```

### iPad (sm–md)
Stejný dvousloupcový layout, finanční box se zúží ale zůstane vedle.

### Mobil (<sm)
Finanční metriky se zobrazí **nahoře** jako kompaktní řádek 3 hodnot vedle sebe (každá ve vlastním mini-boxu), pod nimi formulářová pole pod sebou.

```text
┌──────────┬──────────┬──────────┐
│ Prodej   │ Nákup    │ Zisk     │
│ 123 000  │  98 000  │  25 000  │
└──────────┴──────────┴──────────┘
  Stav         [Select ▼]
  Objednatel   [Combobox]
  Destinace    [Combobox]
  ...
```

## Technické změny

### Soubor: `src/pages/DealDetail.tsx` (řádky ~2871–2993)

1. **Mobilní finanční řádek** (nový blok, viditelný jen `sm:hidden`):
   - `grid grid-cols-3 gap-2 mb-4` s třemi mini-boxy (`rounded-lg bg-muted/50 p-3 text-center`)
   - Každý box: label nahoře (text-xs), hodnota dole (text-sm font-bold)

2. **Hlavní layout** změnit z `flex-col md:flex-row` na:
   - `grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6`
   - Levý sloupec: Stav, Objednatel, Destinace — každý na vlastním řádku (`space-y-3`, bez vnitřního gridu pro tyto 3 pole)
   - Pravý sloupec (`hidden sm:block`, `w-52`): finanční panel se zaoblenými rohy a jemným pozadím (`rounded-xl bg-muted/30 p-5 space-y-4`)

3. **Spodní pole** (Hotel, Datum, Poznámky): zůstanou pod gridem na plné šířce (`col-span-full` nebo mimo grid)

4. Odstranit starý `md:w-48 border-l` panel

## Rozsah
- 1 soubor (`DealDetail.tsx`), ~30 řádků změn
- Žádné databázové změny

