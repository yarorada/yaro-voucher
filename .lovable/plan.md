

## Propojení hotelových dat mezi CRM a webem

### Problém
- **CRM** (tento projekt) ma tabulku `hotel_templates` s hotely, fotkami a popisy
- **YARO Golf Web** ma vsechna data o hotelech natvrdo v kodu (2 781 radku v HotelDetail.tsx) - zadna databaze
- Pri zmene informaci o hotelu je treba upravovat oba projekty zvlast

### Reseni: CRM jako zdroj pravdy pres verejne API

Vytvorime v CRM verejnou backend funkci (API), ktera bude servit hotelova data. Webovy projekt pak bude tato data nacitat z API misto z hardcodovanych konstant.

### Krok 1: Rozsirit tabulku `hotel_templates` v CRM

Pridat sloupce pro data, ktera web potrebuje a CRM zatim neeviduje:

| Sloupec | Typ | Ucel |
|---------|-----|------|
| `slug` | text (unique) | URL identifikator, napr. "gloria-verde" |
| `subtitle` | text | Podtitulek hotelu |
| `nights` | text | Pocet noci, napr. "7 noci" |
| `green_fees` | text | Popis green fees |
| `price_label` | text | Cenovka, napr. "37 900 Kc / os." |
| `golf_courses` | text | Kratky popis hrist pro kartu |
| `benefits` | jsonb | Pole vyhod (ikona, titulek, popis) |
| `room_types` | jsonb | Typy pokoju s fotkami |
| `is_published` | boolean | Zda se hotel zobrazuje na webu |

### Krok 2: Vytvorit verejnou backend funkci `get-hotel-data`

Nova funkce v CRM, ktera:
- Nevyzaduje autentizaci (verejna)
- Vraci seznam hotelu s `is_published = true`
- Podporuje filtr `?slug=gloria-verde` pro detail jednoho hotelu
- Vraci vsechna potrebna data: nazev, popis, fotky, ceny, vyhody, pokoje

### Krok 3: Upravit webovy projekt YARO Golf Web

- Nahradit hardcodovana data volanim API z CRM
- Stranky `HotelDetail.tsx` a `Index.tsx` budou nacitat data dynamicky
- Fotky budou odkazovat na URL z CRM databaze (Lovable Cloud storage)

### Jak to bude fungovat

```text
+------------------+         GET /get-hotel-data          +------------------+
|                  |  -------------------------------------> |                  |
|  YARO Golf Web   |                                       |   CRM (toto)     |
|  (webove stranky)|  <------------------------------------- |                  |
|                  |         JSON s hotely, fotkami,        | hotel_templates  |
+------------------+         popisy, cenami                +------------------+
```

1. V CRM spravujete hotely, fotky a popisy na jednom miste
2. Webove stranky si data automaticky stahuji pres API
3. Zmena v CRM se okamzite projevi na webu

### Technicke detaily

**Backend funkce `get-hotel-data`:**
- Endpoint bez autentizace (verify_jwt = false)
- Cte z tabulky `hotel_templates` kde `is_published = true`
- Vraci JSON pole hotelu se vsemi sloupci

**Migrace na webovem projektu:**
- Odstraneni ~150 statickych importu obrazku
- Nahrazeni objektu `hotelsData` za dynamicky fetch
- Pridani loading stavu a error handlingu

### Postup implementace

1. Pridat nove sloupce do `hotel_templates` v CRM
2. Naplnit data z webu do CRM databaze (jednorázový import)
3. Vytvorit backend funkci `get-hotel-data` v CRM
4. Upravit webovy projekt pro dynamicke nacitani

### Omezeni a poznamky

- Fotky, ktere jsou nyni jako staticke soubory ve webovem projektu, bude treba nahrat do uložiště CRM (bucket `hotel-images`) a pouzivat jejich URL
- Prvni nacteni webu bude zavislet na API volani (mozno pridat cache)
- Import existujicich dat z webu do CRM bude jednorázová akce
