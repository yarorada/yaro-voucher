
# Změna layoutu dialogů služeb - nový řádkový rozvrh s auto-marží a režimem ceny

## Popis změny

Sjednocení layoutu v obou dialozích služeb (VariantServiceDialog + DealDetail) s novým uspořádáním polí:

**Řádek 1:** Datum (od-do) | Osoby | Počet

**Řádek 2:** Nákupní cena | Měna nákupu | Prodejní cena (auto 15% marže) | Měna prodeje | Drop-menu "za osobu / za službu"

**Souhrnný box:** Výsledná cena = prodejní cena * (osoby nebo počet dle zvoleného režimu)

## Co se změní

### 1. Nový layout - Řádek s datem, osobami a počtem
- DateRangePicker, pole Osoby a pole Počet budou na jednom řádku vedle sebe
- DateRangePicker zabere většinu šířky, Osoby a Počet zůstanou kompaktní (w-16)

### 2. Nový layout - Řádek s cenami a režimem
- Na jednom řádku: Nákupní cena + Měna | Prodejní cena + Měna | Select "za osobu / za službu"
- 5 polí v jednom řádku pomocí flexbox s vhodnou šířkou

### 3. Auto-marže 15%
- Při zadání nákupní ceny se automaticky předvyplní prodejní cena = nákupní cena * 1.15 (zaokrouhleno na celé číslo)
- Pouze pokud prodejní cena ještě nebyla ručně zadána (prázdné pole)
- Uživatel může prodejní cenu kdykoliv přepsat

### 4. Nové pole "Režim ceny" (za osobu / za službu)
- Select/dropdown s volbami: "za osobu" a "za službu"
- Výchozí hodnota: "za osobu"
- Souhrnný box "Celková cena" bude násobit:
  - "za osobu": prodejní cena * počet osob
  - "za službu": prodejní cena * počet (quantity)
- Hodnota se uloží do pole `details.price_mode` v databázi

## Technické detaily

### Soubory k úpravě

1. **src/components/VariantServiceDialog.tsx** (řádky 609-706)
   - Přesunout DateRangePicker, Osoby, Počet na jeden řádek
   - Přesunout Nákupní cena + Prodejní cena na jeden řádek, přidat select režimu
   - Přidat state `priceMode` ("per_person" | "per_service")
   - Přidat logiku auto-marže 15% při změně nákupní ceny
   - Upravit výpočet celkové ceny dle zvoleného režimu
   - Uložit `price_mode` do `details`

2. **src/pages/DealDetail.tsx** (řádky 2688-2783)
   - Stejné změny layoutu jako v VariantServiceDialog
   - Přidat `price_mode` do `serviceForm` state
   - Přidat auto-marži a režim ceny

### Nový layout (schéma)

```text
+----------------------------------+--------+--------+
| Datum (od - do)                  | Osoby  | Počet  |
+----------------------------------+--------+--------+

+----------+------+----------+------+---------------+
| Nákupní  | Měna | Prodejní | Měna | za osobu  v   |
| cena     |      | cena     |      |               |
+----------+------+----------+------+---------------+

+---------------------------------------------------+
| Celková cena: XX XXX Kč                           |
+---------------------------------------------------+
```

### Logika auto-marže
- Při změně nákupní ceny (onChange): pokud prodejní cena je prázdná NEBO nebyla ručně upravena, nastavit `price = Math.round(costPrice * 1.15)`
- Přidá se flag `priceManuallySet` pro sledování, zda uživatel ručně přepsal prodejní cenu
- Při editaci existující služby se auto-marže neaplikuje (cena je už nastavená)

### Logika celkové ceny
- `price_mode === "per_person"`: celková cena = price * person_count
- `price_mode === "per_service"`: celková cena = price * quantity
