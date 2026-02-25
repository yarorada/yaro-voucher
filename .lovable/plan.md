

# Prostorově úsporné přiřazení cestujících ke službám

## Aktuální stav

V tabulce služeb na detailu smlouvy je sloupec **Cestující**, kde se zobrazují čísla přiřazených cestujících (nebo "všichni"). Samostatná sekce s maticí checkboxů (`ContractServiceAssignment`) byla odstraněna, protože zabírala příliš mnoho místa.

## Navrhované řešení: Inline editace přímo ve sloupci "Cestující"

Sloupec **Cestující** v tabulce služeb bude klikatelný. Po kliknutí se zobrazí malý **Popover** s checkboxy pro jednotlivé cestující. Uživatel zaškrtne/odškrtne a přiřazení se uloží.

```text
+------------------------------------------+--------+----------+-----------+
| Služba                                   | Termín | Osoby    | Cestující |
+------------------------------------------+--------+----------+-----------+
| Hotel Dona Filipa                        | 5.3.   |    4     | [1,2,3,4] | <-- klik otevře popover
| Green fee - San Lorenzo                  | 6.3.   |    2     |   [1,3]   |
+------------------------------------------+--------+----------+-----------+

         Popover po kliknutí:
        +-------------------------+
        | [x] 1. Jan Novák        |
        | [x] 2. Marie Nováková   |
        | [ ] 3. Petr Svoboda     |
        | [ ] 4. Eva Svobodová    |
        |   [Vybrat všechny]      |
        +-------------------------+
```

## Klicove vlastnosti

- Zadne dalsi misto na obrazovce -- editace probiha primo v existujici tabulce sluzeb
- Popover se zavre kliknutim mimo nej
- Automaticke ukladani pri zmene (bez tlacitka "Ulozit")
- Pokud jsou prirazeni vsichni cestujici, zobrazi se "vsichni" (sedy text)
- Pokud je prirazen podmnozina, zobrazi se jejich cisla (napr. "1, 3")

## Technicke detaily

### Zmeny v souborech

1. **`src/pages/ContractDetail.tsx`**
   - Sloupec "Cestujici" v tabulce sluzeb: nahradit staticky text klikatelnym Popover komponentem
   - Popover zobrazi seznam cestujicich s checkboxy
   - Pri zmene checkboxu se okamzite aktualizuje tabulka `contract_service_travelers` (delete + insert)
   - Invalidace react-query po ulozeni

2. **Zadne nove komponenty** -- logika bude primo v ContractDetail.tsx jako inline Popover

### Datovy tok

- Cteni: existujici query `contract_service_assignments` (jiz implementovano)
- Zapis: toggle checkbox -> delete stary zaznam nebo insert novy do `contract_service_travelers`
- Defaultni stav: pokud pro sluzbu neexistuji zadne zaznamy, povazuji se vsichni cestujici za prirazene (stavajici logika)
