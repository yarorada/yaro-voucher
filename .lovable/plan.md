

# Plán: Sjednocení vizuálního stylu (Apple-like) a responzivity

## Fáze 1: Design tokeny a CSS základ
**Soubor**: `src/index.css`
- Zvýšit `--radius` na `0.75rem`
- Zjemnit stíny (měkčí blur, nižší opacity)
- Přidat `.glass` třídu (`backdrop-blur-xl bg-white/70 dark:bg-gray-900/70`)
- Přidat `.scrollbar-hide` utilitu pro skrytí scrollbaru na tabech
- Zvýšit letter-spacing na headings

## Fáze 2: UI komponenty — Apple styl
**Soubory**: `button.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `input.tsx`
- **Karty**: `rounded-xl`, jemnější border (`border-border/50`), zvýšit padding
- **Taby**: Zaoblenější triggery, `overflow-x-auto scrollbar-hide` na `TabsList`
- **Inputy**: Výška `h-11`, zaoblenější, jemnější focus ring
- **Tlačítka**: Jemnější hover přechody (`transition-all duration-200`), lehký stín na primary
- **Badge**: Pastelové pozadí místo sytých barev (např. `bg-green-100 text-green-800`)

## Fáze 3: Komponenta `PageShell`
**Nový soubor**: `src/components/PageShell.tsx`
- Props: `maxWidth?: "default" | "wide"`, `children`
- `default` = `max-w-6xl`, `wide` = `max-w-[1400px]`
- Vždy: `min-h-screen bg-[var(--gradient-subtle)]`, `mx-auto py-6 md:py-8 px-4 md:px-6`

## Fáze 4: Aplikace PageShell na všechny stránky (~14 souborů)
Nahradit ruční wrapper `<div className="min-h-screen..."><div className="container max-w-...">` za `<PageShell>`:

| Stránka | Aktuální max-w | Nový režim |
|---------|---------------|------------|
| Deals, Contracts, VouchersList, Clients, Suppliers, EmailTemplates, Hotels | `max-w-6xl` | `default` |
| Accounting, Invoicing | `max-w-[1600px]` / žádný | `wide` |
| DealDetail, ContractDetail, VoucherDetail | `max-w-5xl` | `default` |
| CreateDeal, CreateVoucher, CreateContract, EditVoucher | `max-w-4xl` | `default` (s override) |
| Statistics | bez max-w | `default` |
| Index (Dashboard) | `max-w-7xl` | `wide` |

## Fáze 5: Sjednocení stavových badge
**Nový soubor**: `src/components/ContractStatusBadge.tsx`
- Extrahovat inline `statusConfig` z `Contracts.tsx`
- Přepnout na Apple-style pastelové barvy (obě komponenty: `DealStatusBadge` i nový `ContractStatusBadge`)
- Vzor: `bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`

## Fáze 6: Responsivní záložky
**Soubory**: `DealDetail.tsx`, `Invoicing.tsx`, `Suppliers.tsx`
- `TabsList` → `flex overflow-x-auto scrollbar-hide`
- Triggery → `text-xs md:text-sm whitespace-nowrap`

## Fáze 7: Responsivní tabulky a formuláře
**Soubory**: `Accounting.tsx`, `Invoicing.tsx`
- Tabulky: `overflow-x-auto` s `min-w-[900px]` na vnitřní `<table>`
- Formuláře faktur: `grid-cols-1 md:grid-cols-2` místo fixních gridů

## Fáze 8: Sjednocení seznamových karet + DealDetail responsivita
**Soubory**: `Contracts.tsx` (nahradit inline delete za DropdownMenu), `DealDetail.tsx` (gridy `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`)

## Rozsah
- ~16 upravených souborů, 2 nové komponenty
- Žádné změny v databázi
- Čistě vizuální/layoutové úpravy

