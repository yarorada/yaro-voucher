
## Zvětšení loga YARO Travel ve veřejné nabídce

### Problém
Logo je v současnosti nastaveno na `height: '80px'` pomocí inline stylu — ale záhlaví header má `py-6` (24px padding nahoře a dole), což celkovou výšku headeru nijak neomezuje na větší logo. Problém je pravděpodobně v tom, že 80px je stále příliš malé, nebo obrázek samotný je světlý/transparentní a vizuálně splývá.

### Řešení
Zvýšit výšku loga na **140px** pomocí inline stylu, a zároveň zvýšit padding headeru na `py-8`, aby byl header dostatečně vysoký a logo nepůsobilo stísněně.

### Změny

**`src/pages/PublicOffer.tsx`** — řádek 396–397:
```tsx
<div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-between">
  <img src={yaroLogoWide} alt="YARO Travel" style={{ height: '140px', width: 'auto' }} />
```

Tato změna:
- Zvýší logo z 80px na **140px** výšky (téměř 2× větší)
- Zvětší padding headeru z `py-6` na `py-8` pro pohodlnější zobrazení
