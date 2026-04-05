

## Plan: Oprava výpočtu ceny na osobu ve veřejné nabídce

### Současný problém
Funkce `computePerPersonPrices` v `PublicOffer.tsx` špatně počítá cenu na osobu:
- Ne vždy zobrazuje oba řádky (jednolůžkový i dvoulůžkový pokoj)
- Non-hotel služby s režimem `per_service` nesprávně dělí počtem osob — měly by se přičítat jen služby s `per_person`

### Nová logika

**Vždy zobrazit 2 řádky:**
- **Jednolůžkový pokoj** = cena hotelu na 1 osobu + součet všech non-hotel služeb s `price_mode === "per_person"`
- **Dvoulůžkový pokoj** = cena hotelu na 1 osobu (při 2 osobách v pokoji) + stejný součet per-person služeb

**Výpočet hotelové ceny na osobu:**
- Pokud hotel má `price_mode === "per_person"` → cena je již na osobu, použít přímo
- Pokud hotel má `price_mode === "per_service"` (= cena za pokoj) → single: celá cena, double: cena / 2
- Pokud jsou definovány `room_types` → použít cenu z room_type / persons_per_room

**Non-hotel služby (transfery, golf, atd.):**
- Přičíst **pouze** služby s `price_mode === "per_person"` — jejich cena je již za osobu
- Služby s `per_service` se do per-person výpočtu nezapočítávají

### Soubor k úpravě
`src/pages/PublicOffer.tsx` — funkce `computePerPersonPrices` (řádky 234–324)

### Technické detaily

```text
calcNonHotelPerPersonTotal():
  sum = 0
  for each non-hotel service:
    if price_mode === "per_person":
      sum += service.price
  return sum

For each hotel:
  nonHotelCost = calcNonHotelPerPersonTotal()
  
  if room_types defined:
    use room_types (each has persons_per_room and price)
    per_person = rt.price / rt.persons_per_room + nonHotelCost
  else:
    if price_mode === "per_person":
      singlePrice = hotelPrice + nonHotelCost
      doublePrice = hotelPrice + nonHotelCost  (same — already per person)
    else (per_service / per room):
      singlePrice = hotelPrice + nonHotelCost
      doublePrice = hotelPrice / 2 + nonHotelCost
    
    → emit line "Jednolůžkový pokoj" with singlePrice
    → emit line "Dvoulůžkový pokoj" with doublePrice
```

