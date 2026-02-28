## Úpravy PDF voucheru – Flight Details & Confirmed Tee Times

### Co se změní

**1. Flight Details – jednořádkový formát s tučnými destinacemi**

Aktuální stav: datum, kód letu i destinace jsou všechny tučné.

Nový formát na jednom řádku:

```
21.06.26 · OK 123 · Prague → Antalya · Dep. 10:30 · Arr. 14:15 · Pax: 2 ADT
```

- Datum (`datePart`) – normální font
- Separator `·` – normální
- Kód letu (`flightCode`) – normální
- Separator `·` – normální
- `fromCity→toCity` – **tučně**
- Zbytek (Departure, Arr, Pax) – normální font

**2. Confirmed Tee Times – přidat počet hráčů za tečku uprostřed řádku**

Aktuální formát: `21 Jun  Golf Club at 10:00 (4 golfers)`

Nový formát:

```
21.06.26 · Golf Club · 10:00 - 12:00 · 4 golfers
```

Konkrétně: za časem přidat  `· N golfers` místo závorky – přehledný, jednotný styl s tečkami jako separátory.

### Technické změny

Soubor: `src/pages/VoucherDetail.tsx`, sekce Flight Details (řádky ~337–342) a Tee Times (řádky ~380–386).

**Flight Details (řádky ~337–342):**

```typescript
// Datum a kód letu – normální font
if (datePart) { pn(datePart); pn(" · "); }
if (flightCode) { pn(flightCode); pn(" · "); }
// Destinace – tučné
if (fromCity && toCity) { pb(`${fromCity}→${toCity}`); }
// Zbytek – normální
if (f.departureTime) { pn(` · Departure ${f.departureTime}`); }
if (f.arrivalTime) { pn(` · Arr ${f.arrivalTime}`); }
if (f.pax) { pn(` · Pax: ${f.pax} ADT`); }
```

**Tee Times (řádky ~380–386):**

```typescript
if (datePart) { printBold(datePart); printNormal(" · "); }
printBold(clubPart);
if (timePart) {
  printNormal(" · "); printNormal(timePart);
  if (endTime) { printNormal(` - ${endTime}`); }
}
if (paxCount > 0) { printNormal(` · ${paxCount} golfers`); }
```

### Rozsah změn

- Pouze `src/pages/VoucherDetail.tsx`, ~10 řádků
- Žádné databázové změny
- Žádné nové závislosti