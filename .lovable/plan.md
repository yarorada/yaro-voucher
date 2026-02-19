

# Pridani sloupce "Pocet" (quantity) do tabulky sluzeb

## Souhrn

Pridame novy sloupec `quantity` (Pocet) do tabulek `deal_services` a `deal_variant_services`. Tento sloupec bude nasobit cenu sluzby. Stavajici `person_count` se prejmenuje na "Pocet osob" a bude slouzit vyhradne pro vypocet ceny na osobu a generovani voucheru.

## Zmeny v databazi

Pridame sloupec `quantity` (integer, default 1, NOT NULL) do obou tabulek:
- `deal_services`
- `deal_variant_services`

## Zmeny v logice vypoctu ceny

Vsude, kde se nyni nasobi `price * person_count`, se zmeni na `price * quantity`. Konkretne:

| Misto | Stara logika | Nova logika |
|-------|-------------|-------------|
| DealDetail - SortableServiceRow | `price * person_count` | `price * quantity` |
| DealDetail - calculateTotalPrice | `price * person_count` | `price * quantity` |
| DealDetail - totalCostPrice | `cost_price * person_count` | `cost_price * quantity` |
| DealDetail - celkova cena dole | `price * person_count` | `price * quantity` |
| PublicOffer - VariantCard | `price * person_count` | `price * quantity` |
| send-offer-email - vPrice | `price * person_count` | `price * quantity` |

## Zmeny v UI

### Formular sluzby (DealDetail.tsx)
- Pole "Pocet *" se prepoji na novy sloupec `quantity` (misto `person_count`)
- Pole "Pocet osob" zustane napojene na `person_count_unit` v details (beze zmeny)
- `person_count` se presune do formulare jako "Pocet osob" -- nebo se pouzije stavajici pole `person_count_unit`. Nutno sjednotit: `person_count` bude pocet osob, `quantity` bude nasobitel ceny.

### Formular sluzby (VariantServiceDialog.tsx)
- Stejna uprava -- pridani pole `quantity`, prepojeni cenoveho nasobitele

### Tabulka sluzeb (DealDetail.tsx)
- Sloupec "Osoby" se prejmenuje na "Pocet"
- Zobrazi hodnotu `quantity`
- Pod cenou se zobrazi `cena x quantity` pokud quantity > 1

### Verejne stranky a emaily
- `get-public-offer` a `send-offer-email` - fetchuji novy sloupec `quantity`, pouziji ho pro nasobeni ceny
- `person_count` zustane dostupny pro budouci rekapitulaci ceny na osobu

## Migrace dat

Existujici data: stavajici `person_count` obsahuje hodnoty, ktere se pouzivaly jako nasobitel. Pri migraci zkopirujeme `person_count` do noveho `quantity` a `person_count` nastavime na 1 (nebo ponechame, protoze puvodni vyznam byl smiseny). Bezpecnejsi varianta: `quantity = person_count`, `person_count` ponechat beze zmeny -- uzivatel muze pozdeji upravit rucne.

## Technicke detaily

### SQL migrace

```sql
ALTER TABLE deal_services ADD COLUMN quantity integer NOT NULL DEFAULT 1;
ALTER TABLE deal_variant_services ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Zkopirovat stavajici person_count do quantity
UPDATE deal_services SET quantity = COALESCE(person_count, 1);
UPDATE deal_variant_services SET quantity = COALESCE(person_count, 1);
```

### Soubory k uprave

1. **`src/pages/DealDetail.tsx`**
   - serviceForm: pridat pole `quantity` (default "1")
   - SortableServiceRow: zobrazit `quantity`, nasobit `price * quantity`
   - calculateTotalPrice: `price * quantity`
   - totalCostPrice: `cost_price * quantity`
   - Celkova cena: `price * quantity`
   - Editace sluzby: nacist/ulozit `quantity`
   - Tabulka: hlavicka "Pocet" misto "Osoby"
   - Formular: pole "Pocet" pro quantity, pole "Pocet osob" pro person_count (pouzit primo DB sloupec `person_count`, ne `person_count_unit` z details)

2. **`src/components/VariantServiceDialog.tsx`**
   - Pridat stav `quantity`, napojit na formular
   - Ukladat `quantity` do DB
   - Pole "Pocet" a "Pocet osob" vedle sebe

3. **`src/pages/PublicOffer.tsx`**
   - Fetchovat `quantity`
   - Pouzit `price * quantity` pro celkovou cenu varianty
   - `person_count` pouzit pro rekapitulaci ceny na osobu

4. **`supabase/functions/get-public-offer/index.ts`**
   - Pridat `quantity` do select dotazu

5. **`supabase/functions/send-offer-email/index.ts`**
   - Pridat `quantity` do select dotazu
   - Pouzit `price * quantity` pro celkovou cenu

6. **`src/components/DealVariants.tsx`**
   - Zkontrolovat, zda se zde pocita cena -- pokud ano, prepojit na `quantity`

