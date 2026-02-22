

# Verejne stranky s hotely

## Co udelame

Pridame do aplikace verejne pristupne stranky pro zobrazeni hotelu -- seznam vsech publikovanych hotelu a detail jednotliveho hotelu. Stranky budou bez prihlaseni, podobne jako existujici `/offer/:token` a `/sign-contract`.

## Stranky

### 1. Seznam hotelu (`/hotely`)
- Nacteni dat pres edge funkci `get-hotel-data` (uz existuje, verejna)
- Karta pro kazdy hotel: hero fotka, nazev, podtitulek, cena, pocet noci
- Kliknuti presmeruje na detail hotelu
- Responzivni grid (1/2/3 sloupce)
- YARO logo v hlavicce, kontaktni udaje v paticce

### 2. Detail hotelu (`/hotely/:slug`)
- Nacteni pres `get-hotel-data?slug=xxx`
- Galerie fotek (hero + carousel, podobne jako v PublicOffer)
- HTML popis hotelu
- Info: pocet noci, green fees, golfova hriste, cena
- Benefity a typy pokoju (z JSONB poli)
- Odkaz na oficialní web hotelu
- Tlacitko "Kontaktujte nas" / odkaz na kontakt

## Technicky detail

### Nove soubory
- `src/pages/PublicHotels.tsx` -- seznam hotelu
- `src/pages/PublicHotelDetail.tsx` -- detail hotelu

### Zmeny v existujicich souborech
- `src/App.tsx` -- pridani dvou verejnych rout:
  ```
  <Route path="/hotely" element={<PublicHotels />} />
  <Route path="/hotely/:slug" element={<PublicHotelDetail />} />
  ```

### Data
- Pouzijeme existujici edge funkci `get-hotel-data` (verify_jwt = false)
- Zadne zmeny v databazi ani RLS

### Design
- Cistý, moderni design s YARO brandingem
- Tmave zahlavi s logem, svetly obsah
- Podobny vizualni styl jako PublicOffer stranka
- Mobilne responzivni

