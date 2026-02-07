

## Platební kalendář, číslo účtu a QR kód v cestovní smlouvě

Tento plán řeší tři věci najednou:

### 1. Oprava chybějícího platebního kalendáře

Aktuální smlouva CS-260009 nemá žádné platby v databázi -- byla vytvořena dříve, než se nasadil kód pro automatické kopírování plateb z obchodního případu. Platby je nutné ručně synchronizovat SQL příkazem pro všechny existující smlouvy, které nemají platby, ale jejich deal ano.

### 2. Číslo účtu 227993932/0600

Číslo účtu se přidá:
- Do PDF šablony smlouvy (sekce Platební kalendář)
- Do webového zobrazení platebního kalendáře
- Do výchozích údajů dodavatele (ContractAgencyInfo)
- Volitelně do databáze jako nový sloupec `agency_bank_account` s výchozí hodnotou

### 3. QR kód na platbu (formát SPAYD)

QR kód bude generován ve formátu **SPAYD** (Short Payment Descriptor), což je český standard pro QR platby podporovaný všemi českými bankami. QR kód bude obsahovat:
- IBAN účet (převedený z 227993932/0600)
- Částku k úhradě
- Variabilní symbol (číslo smlouvy)
- Měnu (CZK)
- Zprávu pro příjemce

QR kód se zobrazí jak v PDF exportu, tak na webové stránce u platebního kalendáře.

---

### Technické detaily

#### Databázové změny
- Nový sloupec `agency_bank_account` v tabulce `travel_contracts` s výchozí hodnotou `'227993932/0600'`
- SQL aktualizace existujících smluv, aby měly vyplněný účet
- Synchronizace plateb z `deal_payments` do `contract_payments` pro smlouvy, které platby nemají

#### Nová závislost
- NPM balíček `qrcode` -- knihovna pro generování QR kódů jako data URL (obrázek v base64)

#### Úpravy souborů

**`src/components/ContractPdfTemplate.tsx`**
- Do sekce "Platební kalendář" přidat řádek s číslem účtu pod tabulkou
- Přidat komponentu pro QR kód vedle platebního kalendáře (generovaný pomocí `qrcode.toDataURL()`)
- QR kód bude obsahovat SPAYD řetězec: `SPD*1.0*ACC:CZ6506000000000227993932*AM:{castka}*CC:CZK*X-VS:{cislo_smlouvy}*MSG:Platba za smlouvu {cislo}`

**`src/components/ContractPaymentSchedule.tsx`**
- Zobrazit číslo účtu v sekci platebního kalendáře na webu
- Přidat malý QR kód pro každou nezaplacenou platbu (nebo souhrnný QR kód)

**`src/components/ContractAgencyInfo.tsx`**
- Přidat pole `agency_bank_account` do formuláře a zobrazení
- Aktualizovat výchozí hodnoty YARO_DEFAULTS

**`src/pages/CreateContract.tsx`**
- Přidat `agency_bank_account` do výchozích hodnot při vytváření smlouvy

**`src/pages/ContractDetail.tsx`**
- Předat `agency_bank_account` do komponent, které ho potřebují

#### Konverze českého účtu na IBAN
Účet `227993932/0600` se převede na IBAN formát:
- Kód banky: 0600 (MONETA Money Bank)
- Předčíslí: 000000
- Číslo účtu: 0227993932
- IBAN: CZ6506000000000227993932 (kontrolní součet bude vypočítán)

