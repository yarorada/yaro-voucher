

# Pridani destinace a zeme k hotelum

## Co udelame

Pri vytvareni/editaci hotelu v databazi bude mozne pridat destinaci (ktera obsahuje i zemi). Vyuzijeme existujici `DestinationCombobox`, ktery uz umi navrhnout destinaci i zemi a rovnou je vytvorit.

## Zmeny

### 1. Databaze -- novy sloupec
- Pridat `destination_id` (uuid, nullable, FK na `destinations`) do tabulky `hotel_templates`

### 2. Stranka Hotels.tsx -- editacni formular
- Pridat `DestinationCombobox` do editacniho dialogu hotelu (sekce "Zakladni info")
- Pri ulozeni odeslat `destination_id` na server
- Zobrazit aktualni destinaci a zemi na karte hotelu (pod subtitulkem)

### 3. Edge funkce get-hotel-data
- Pridat join na `destinations` a `countries` do selectu
- Vratit `destination_name` a `country_name` v odpovedi API (pro pouziti na webu yarogolf.cz)

## Technicke detaily

### Migrace SQL
```sql
ALTER TABLE hotel_templates
  ADD COLUMN destination_id uuid REFERENCES destinations(id) ON DELETE SET NULL;
```

### Hotels.tsx
- Import `DestinationCombobox`
- Pridat `destination_id` do `formData` stavu
- Zobrazit komponentu v editacnim dialogu s labelem "Destinace / Zeme"
- Ulozit `destination_id` pri handleSave

### get-hotel-data
- Zmenit select z `hotel_templates` na join:
  ```
  hotel_templates(*, destinations(name, countries(name, iso_code)))
  ```
- Do transformovaneho vystupu pridat `destination_name` a `country_name`

