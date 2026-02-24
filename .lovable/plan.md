# Účetní přehled - Rozklad kalkulace zájezdů

## Co se vytvoří

Nová stránka "Účetnictví" dostupná z postranního menu, která zobrazí tabulku ve formátu shodném s přiloženým screenshotem z Apple Numbers. Tabulka slouží ke sdílení s účetním a obsahuje rozklad smluv na zálohy a vyúčtování s automatickým výpočtem DPH.

## Sloupce tabulky


| Sloupec                 | Zdroj dat                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **Smlouva**             | `contract_number` z `travel_contracts`                                                             |
| **Klient**              | `first_name + last_name` z `clients`                                                               |
| **Země**                | `countries.name` přes `destinations`                                                               |
| **Destinace**           | `destinations.name`                                                                                |
| **Od**                  | `deals.start_date` (DD.MM.YY)                                                                      |
| **Do**                  | `deals.end_date` (DD.MM.YY)                                                                        |
| **Prodej záloha**       | Prodejní cena v Dealu v době odeslání smlouvy                                                      |
| **Nákup záloha**        | Nákupní cena v Dealu ve chvíli odeslání smlouvy                                                    |
| **Prodej vyúčtování**   | Prodejní cena v Dealu v době potvrzení smlouvy                                                     |
| **Nákup vyúčtování**    | Nákupní cena v Dealu v době potvrzení smlouvy                                                      |
| **Provize prodej**      | Toto pole můžeš smazat                                                                             |
| **Zisk záloha**         | Prodej záloha - Nákup záloha                                                                       |
| **Zisk vyúčtování**     | Prodej vyúčtování - Nákup vyúčtování                                                               |
| **DPH záloha EU**       | 21 % ze zisku zálohy, pokud země patří do EU (viz seznam) a destinace není na Kanárských ostrovech |
| **DPH vyúčtování EU**   | 21 % ze zisku vyúčtování za stejných podmínek                                                      |
| **Rozdíl proti odvodu** | DPH vyúčtování - DPH záloha (korekce)                                                              |
| **Poznámka**            | Volné textové pole                                                                                 |


## Logika zobrazení řádků

- **Řádek zálohy**: Zobrazí se ve chvíli, kdy smlouva existuje (status != cancelled) a má platbu typu `deposit`
- **Řádek vyúčtování**: Zobrazí se, až existuje platba typu `final` a je zaplacená, nebo podle skutečně přijatých plateb

V praxi bude každá smlouva jeden řádek se všemi sloupci (záloha + vyúčtování vedle sebe), jak je vidět na screenshotu.

## DPH pravidla

- **21 % ze zisku** pokud je země destinace v seznamu EU zemí
- **Výjimka 0 %**: destinace Gran Canaria, Tenerife, Lanzarote, Fuerteventura (Kanárské ostrovy - přestože Španělsko je v EU)
- **Non-EU země**: DPH = 0

## Barevné zvýraznění řádků

- **Cervena**: Smlouvy, kde konec zájezdu (`deals.end_date`) proběhl v **minulém kalendářním měsíci** (vzhledem k aktuálnímu datu)
- **Modra**: Smlouvy, kde **první platba** (`contract_payments` s nejstarším `paid_at`) proběhla v **minulém kalendářním měsíci**

## Filtry v horní liště

- Filtr podle roku (ze `start_date`)
- Filtr podle měsíce
- Tlačítko "Export CSV" pro stažení tabulky

## Technické kroky

### 1. Nová stránka `src/pages/Accounting.tsx`

- Načtení dat: `travel_contracts` JOIN `deals`, `destinations`, `countries`, `clients`, `contract_payments`, `deal_services` (pro nákupní ceny)
- Výpočet nákupní ceny z `deal_profitability` view (total_costs)
- Proporcionální rozdělení nákupní ceny mezi zálohu a vyúčtování podle poměru plateb
- Seznam EU zemí a Kanárských výjimek jako konstanta
- Tabulka s horizontálním scrollem pro všechny sloupce

### 2. Registrace v routeru (`App.tsx`)

- Nová route `/accounting`

### 3. Přidání do navigace (`AppSidebar.tsx`)

- Nová položka "Účetnictví" s ikonou `Calculator`

### 4. Export CSV

- Stejný princip jako na stránce Smlouvy: UTF-8 BOM, středníkový oddělovač, české formátování