

## Fakturační systém — plán implementace

### Přehled
Vytvoření kompletního fakturačního modulu s evidencí přijatých a vydaných faktur, navigační položkou "Fakturace", napojením na existující dodavatelské faktury z obchodních případů, QR kódy pro platby a automatickým doplněním dat firmy podle IČO z ARES.

---

### 1. Databáze — nové tabulky

**`invoices`** — hlavní tabulka faktur (přijaté i vydané):
- `id`, `user_id`, `invoice_type` (received/issued), `invoice_number`
- `supplier_id` (odkaz na suppliers — odběratel/dodavatel)
- `deal_id` (nullable — vazba na obchodní případ, pokud existuje)
- `deal_supplier_invoice_id` (nullable — odkaz na původní fakturu z deal_supplier_invoices)
- `client_name`, `client_ico`, `client_dic`, `client_address`
- `supplier_name`, `supplier_ico`, `supplier_dic`, `supplier_address`
- `total_amount`, `currency`, `issue_date`, `due_date`, `paid`, `paid_at`
- `variable_symbol`, `bank_account`, `iban`
- `file_url`, `file_name`, `notes`
- `created_at`, `updated_at`
- RLS: authenticated users, s ohledem na `has_full_data_scope`

**Migrace**: Jednorázový import existujících záznamů z `deal_supplier_invoices` do tabulky `invoices` s `invoice_type = 'received'` a vazbou přes `deal_supplier_invoice_id`.

### 2. Edge funkce — ARES lookup

**`ares-lookup`** — nová edge funkce:
- Přijme IČO, zavolá veřejné ARES API (`https://ares.gov.cz/ekonomicke-subjekty-v-registru-statistickem-a-telefonnim/rest/ekonomicke-subjekty/{ico}`)
- Vrátí: název firmy, DIČ, adresu (ulice, město, PSČ)
- Nevyžaduje API klíč (veřejné API)

### 3. Navigace

- Přidat položku "Fakturace" do `AppSidebar.tsx` s ikonou `Receipt` mezi Účetnictví a Šablony e-mailů
- Přidat routu `/invoicing` do `App.tsx`

### 4. Stránka Fakturace (`src/pages/Invoicing.tsx`)

**Záložky**: Přijaté faktury | Vydané faktury

**Přijaté faktury**:
- Tabulka: číslo, dodavatel, částka, měna, datum vystavení, datum zaplacení, stav (zaplaceno/nezaplaceno), vazba na deal
- Automatický import z deal_supplier_invoices (synchronizace)
- Možnost přidat novou fakturu bez vazby na deal (upload souboru + OCR)
- U faktur bez QR kódu — generování QR platebního kódu (SPAYD, pouze CZK) pomocí existující `spayd.ts` knihovny

**Vydané faktury**:
- Formulář: odběratel (výběr z dodavatelů nebo zadání IČO → ARES doplnění), částka, měna, VS, datum, bankovní účet
- QR kód pro platbu automaticky generován
- Možnost duplikovat/kopírovat existující fakturu
- Seznam odběratelů se přebírá z tabulky `suppliers`

### 5. QR kód pro platby

- Využití existující knihovny `src/lib/spayd.ts` (bankAccountToIban, generateSpaydString, generatePaymentQrDataUrl)
- Pro přijaté faktury: generování QR pokud je zadán bankovní účet/IBAN, částka a VS
- Pro vydané faktury: automatické generování QR s firemním účtem YARO

### 6. Synchronizace s deal_supplier_invoices

- Při vytvoření nové faktury v obchodním případě se automaticky vytvoří odpovídající záznam v `invoices`
- Databázový trigger na `deal_supplier_invoices` INSERT/UPDATE/DELETE → sync do `invoices`
- Změna stavu zaplacení v jednom místě se projeví v obou

---

### Technické detaily

```text
Struktura:
├── supabase/migrations/  — CREATE TABLE invoices + trigger sync
├── supabase/functions/ares-lookup/index.ts  — ARES API proxy
├── src/pages/Invoicing.tsx  — hlavní stránka
├── src/components/InvoiceForm.tsx  — formulář pro vytvoření/editaci
├── src/components/InvoiceList.tsx  — seznam faktur s filtry
├── src/components/AresLookup.tsx  — komponenta pro doplnění dat z IČO
├── src/components/AppSidebar.tsx  — nová nav položka
└── src/App.tsx  — nová routa
```

ARES API endpoint (veřejný, bez klíče):
`GET https://ares.gov.cz/ekonomicke-subjekty-v-registru-statistickem-a-telefonnim/rest/ekonomicke-subjekty/{ico}`

