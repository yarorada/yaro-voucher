
## Přidání ikon k zavazadlům v PDF smlouvě

### Co se změní

V souboru `src/components/ContractPdfTemplate.tsx` se upraví sestavování řetězce `baggageLine` tak, aby každá položka měla emoji ikonu.

### Nový formát

```
🎒 Taška   💼 Palubní 8 kg   🧳 Odbavené 23 kg   🏌️ Golfbag 15 kg
```

Pokud váha není zadána:
```
🎒 Taška   💼 Palubní (v ceně)   🧳 Odbavené (v ceně)
```

### Přiřazení ikon

| Typ | Emoji | Důvod |
|---|---|---|
| Taška na palubu (cabin bag) | 🎒 | Batoh / příruční taška |
| Palubní zavazadlo (hand luggage) | 💼 | Příruční kufřík |
| Odbavené zavazadlo (checked luggage) | 🧳 | Velký kufr |
| Golfbag | 🏌️ | Golf |

### Technické detaily

Emoji fungují v html2pdf.js bez problémů — renderer převádí HTML na canvas (rastrový obrázek), kde jsou emoji vykreslena systémovým fontem prohlížeče. Není riziko rozhození layoutu.

Vlastní PNG (golf-bag.png) v PDF **nelze použít** bez base64 enkódování, proto je emoji `🏌️` správná volba.

### Soubor ke změně

- **`src/components/ContractPdfTemplate.tsx`** — úprava řádků 345–350 (sestavení `parts[]` pole s emoji prefixem)
