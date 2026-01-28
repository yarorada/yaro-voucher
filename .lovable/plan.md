
# Plán: Ignorování diakritiky při kontrole duplicit klientů

## Popis problému
Při importu klientů (hromadném i jednotlivém) se kontrola duplicit provádí pomocí SQL dotazu `ilike`, který nerozpozná, že "Jiří Novák" a "Jiri Novak" je stejná osoba. Databáze obsahuje jména uložená bez diakritiky (normalizovaná), ale kontrola přicházejících dat nefunguje správně.

## Řešení
Změnit strategii kontroly duplicit ve všech relevantních souborech - místo použití `ilike` dotazu načíst všechny klienty a porovnat jména lokálně po odstranění diakritiky na obou stranách.

---

## Soubory k úpravě

### 1. BulkClientUpload.tsx
**Funkce:** `checkForDuplicate` (řádky 217-260)

**Problém:** Kontrola podle jména používá `ilike` bez normalizace diakritiky
```typescript
// Aktuálně - nefunguje pro Jiří vs Jiri
.ilike('first_name', extractedData.first_name)
.ilike('last_name', extractedData.last_name)
```

**Oprava:**
- Importovat `removeDiacritics` z `@/lib/utils`
- Načíst všechny klienty
- Porovnat jména lokálně po normalizaci obou stran

### 2. VoucherForm.tsx
**Funkce:** `handleConfirmImport` (řádky 380-385)

**Problém:** Stejný problém - hledá normalizované jméno pomocí `ilike`

**Oprava:**
- Před cyklem načíst všechny existující klienty
- V cyklu porovnávat lokálně s normalizací
- Efektivnější - jedno načtení místo N dotazů

### 3. ClientCombobox.tsx
**Funkce:** `handleCreateClient` (řádky 87-133)

**Problém:** Nekontroluje duplicity vůbec před vytvořením nového klienta

**Oprava:**
- Přidat kontrolu duplicit před `insert`
- Načíst všechny klienty
- Porovnat s normalizací diakritiky
- Pokud existuje duplicita, zobrazit chybu nebo použít existujícího

---

## Technické detaily

### Vzorový kód pro kontrolu duplicit
```typescript
import { removeDiacritics } from "@/lib/utils";

// Načíst všechny klienty jednou
const { data: allClients } = await supabase
  .from('clients')
  .select('id, first_name, last_name, passport_number, id_card_number');

// Normalizovat vstupní jméno
const normalizedFirstName = removeDiacritics(firstName.trim().toLowerCase());
const normalizedLastName = removeDiacritics(lastName.trim().toLowerCase());

// Najít duplicitu s normalizací obou stran
const existingClient = allClients?.find(client => 
  removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
  removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName
);
```

### Optimalizace pro hromadný import
V `VoucherForm.tsx` se aktuálně provádí dotaz do DB pro každého klienta v cyklu. Nová implementace:
1. Načte všechny klienty před cyklem (1 dotaz)
2. V cyklu pouze lokální porovnání (rychlé)
3. Po vytvoření nového klienta ho přidá do lokálního pole pro další porovnání

---

## Shrnutí změn
| Soubor | Změna |
|--------|-------|
| `BulkClientUpload.tsx` | Přidat import `removeDiacritics`, změnit `checkForDuplicate` na lokální porovnání |
| `VoucherForm.tsx` | Optimalizovat `handleConfirmImport` - načíst klienty před cyklem, lokální porovnání |
| `ClientCombobox.tsx` | Přidat kontrolu duplicit před vytvořením klienta |

Všechny soubory budou používat centrální funkci `removeDiacritics` z `src/lib/utils.ts` pro konzistenci.
