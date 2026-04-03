

# Plán: Mobilní zobrazení detailu obchodního případu

## Problém
Na mobilu (390px) je 5 záložek v horizontální liště příliš mnoho — scrollování je neintuitivní a uživatel nevidí, že existují další záložky. Formulářové gridy `grid-cols-2` jsou na telefonu stísněné.

## Řešení záložek: Dropdown select na mobilu

Na mobilu (pod `md` breakpoint) nahradit `TabsList` elementem `Select`, který zobrazí aktuální záložku jako dropdown. Na desktopu zůstanou klasické taby beze změny.

```text
┌─────────────────────────┐
│ Základní info        ▼  │  ← Select dropdown na mobilu
└─────────────────────────┘

vs desktop:
[Základní info] [Cestující] [Platební kalendář] [Služby] [Dokumenty]
```

Implementace: Přidat `useState` pro aktivní tab, na mobilu zobrazit `<Select>` s 5 možnostmi, na desktopu klasický `<TabsList>`. Obojí řídí stejný stav.

## Změny

### 1. Mobilní záložky v DealDetail.tsx (~řádky 2795-2802)
- Přidat `useState` pro řízený tab (`activeTab`)
- Přidat `<Tabs value={activeTab} onValueChange={setActiveTab}>`
- Pod `md` breakpoint: zobrazit `<Select>` s ikonami a názvy záložek
- Nad `md` breakpoint: zobrazit stávající `<TabsList>` beze změny
- CSS: `<Select className="md:hidden">`, `<TabsList className="hidden md:flex">`

### 2. Hlavička — responsivní layout (~řádky 2722-2793)
- Deal number + popis: na mobilu zalamovat pod sebe (`flex-col` vždy, popis na vlastním řádku)
- Badge menší na mobilu

### 3. Formulářové gridy (~řádky 2814+)
- Změnit `grid-cols-2 md:grid-cols-3` na `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- Formulářová pole se na telefonu zobrazí pod sebou

### Soubory k úpravě
- `src/pages/DealDetail.tsx` — mobilní záložky, hlavička, gridy

## Rozsah
1 soubor, bez databázových změn, čistě UI/layout.

