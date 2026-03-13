
## Two fixes in one

### 1. Ceny na osobu se nezobrazují — příčina

`computePerPersonPrices` vrátí prázdné pole pokud `hotels.length === 0`. Funkce hledá služby s `service_type === "hotel"`. Pokud varianta nemá hotelovou službu (nebo má nulové ceny), funkce vrátí `[]` a sekce se vůbec nezobrazí.

Ale i kdyby hotel existoval — funkce vypočítá `pricePerPerson = hotelPerPerson + sharedPerPerson`. Pokud všechny ceny jsou `null` nebo `0`, výsledek je 0 a zobrazí se `0 CZK`, což možná user nevidí jako „cenu".

**Oprava**: Přidat fallback — pokud `hotels.length === 0` ale existují jiné služby s cenami, zobrazit shrnutí bez hotelového členění. Zároveň filtrovat řádky s cenou 0.

### 2. Tlačítko „Otevřít v novém okně" v popovre Share

Do `PopoverContent` v `ShareOfferButton.tsx` přidat tlačítko vedle Copy linku:

```
[ input: url ] [ copy ] [ external link → ]
```

Nebo samostatné tlačítko pod řádkem s inputem:

```
[ 🔗 Zkopírovat odkaz ]  [ ↗ Otevřít v novém okně ]
```

**Implementace**: Přidat `ExternalLink` icon z lucide-react, tlačítko volá `window.open(publicUrl, '_blank')`.

---

### Soubory ke změně

**`src/pages/PublicOffer.tsx`**
- `computePerPersonPrices`: přidat fallback pro případ bez hotelu — agregovat celkovou cenu ze všech služeb a rozdělit dle `person_count`; filtrovat výsledné řádky kde `pricePerPerson === 0`

**`src/components/ShareOfferButton.tsx`**
- Importovat `ExternalLink` z `lucide-react`
- V `PopoverContent`, vedle copy tlačítka přidat druhé tlačítko s `ExternalLink` ikonou — `window.open(publicUrl, '_blank')`

### Žádné DB změny
