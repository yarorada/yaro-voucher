

## Uprava promptu pro generovani popisu hotelu

### Co se zmeni

Upravim prompt v backend funkci `search-hotel-info`, aby generoval popis hotelu podle zadane sablony s 5 odstavci:

1. **Uvodni odstavec** - zakladni info o hotelu, hvezdicky, rozloha, poloha, hlavni prednosti
2. **Pokoje a stravovani** - pocet pokoju, vybaveni, typ stravovani, restaurace
3. **Golf** - golfova hriste, pocet jamek, par, designer, driving range, academy
4. **Wellness a volny cas** - bazeny, spa, plaz, fitness, dalsi aktivity
5. **Zaverecne doporuceni** - proc je hotel idealni pro golfisty, dostupnost dalsich hrist

### Technicke zmeny

**Soubor: `supabase/functions/search-hotel-info/index.ts`**

- Prepisu user prompt (`prompt` promennou) tak, aby obsahoval presnou strukturu 5 odstavcu s popisem, co ma kazdy odstavec obsahovat
- Prepisu system prompt, aby AI dodrzovala format bez nadpisu (pouze odstavce oddelene prazdnym radkem)
- Pridam instrukci, ze text nema obsahovat markdown formatovani (hvezdicky, hashe) - pouze cisty text s HTML tagy `<strong>` pro tucne, pokud je potreba
- Zachovam konverzi markdown na HTML a preklad do cestiny pokud odpoved prijde anglicky

### Priklad noveho promptu

```
Napiš popis hotelu "{hotelName}" pro golfové cestovatele.
Popis musí mít přesně 5 odstavců oddělených prázdným řádkem:

1. odstavec: Základní představení hotelu - název, počet hvězdiček, rozloha areálu,
   poloha, hlavní přednost (např. přímý přístup ke golfovému hřišti).

2. odstavec: Pokoje a stravování - počet pokojů, typ pokojů, vybavení,
   koncept stravování (all inclusive / polopenze), počet restaurací.

3. odstavec: Golf - název golfového hřiště, designer, počet jamek, par,
   driving range, putting green, golf academy.

4. odstavec: Wellness a volný čas - bazény, wellness/spa, hammam, sauna,
   fitness, pláž a její vzdálenost.

5. odstavec: Závěrečné doporučení - proč je hotel ideální pro golfisty,
   dostupnost dalších hřišť v okolí.

Nepoužívej žádné nadpisy, odrážky ani markdown formátování.
Piš pouze plynulý text v odstavcích.
```

