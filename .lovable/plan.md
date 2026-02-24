
# Evidence dokladů k zaplacení dodavatelům

## Popis
Do detailu obchodního případu bude přidána nová sekce "Doklady dodavatelům", kde uživatel nahraje faktury/doklady od dodavatelů. Systém pomocí OCR automaticky extrahuje klíčové údaje (částka, dodavatel, datum vystavení), zobrazí je k potvrzení, a po schválení uloží. U každého dokladu bude možnost evidovat zaplacení, datum a formu platby (Moneta/Amnis). Doklady půjde zpětně stáhnout.

## Technické kroky

### 1. Databázová tabulka `deal_supplier_invoices`
Nová tabulka pro evidenci dokladů:
- `id` (uuid, PK)
- `deal_id` (uuid, FK na deals)
- `file_url` (text) - odkaz na soubor ve storage
- `file_name` (text) - původní název souboru
- `supplier_name` (text) - název dodavatele (z OCR)
- `total_amount` (numeric) - celková částka (z OCR)
- `issue_date` (date) - datum vystavení (z OCR)
- `is_paid` (boolean, default false) - zaplaceno
- `paid_at` (date, nullable) - datum zaplacení
- `payment_method` (text, nullable) - forma: 'moneta' nebo 'amnis'
- `user_id` (uuid, default auth.uid())
- `created_at` (timestamptz)

RLS: Authenticated users mají plný přístup (podle vzoru ostatních deal tabulek).

### 2. Storage bucket `supplier-invoices`
Nový veřejný bucket pro nahrávání dokladů.

### 3. Edge funkce `ocr-supplier-invoice`
Nová edge funkce využívající Lovable AI (gemini-2.5-flash) k extrakci:
- `supplier_name` - název dodavatele
- `total_amount` - celková částka k úhradě
- `issue_date` - datum vystavení (DD.MM.YYYY)

Formát volání bude shodný s existující `ocr-document` funkcí.

### 4. Nová komponenta `DealSupplierInvoices`
Samostatná React komponenta umístěná v detailu dealu (pod sekci DealDocumentsSection):
- **Nahrávání**: Drag & drop nebo kliknutí, podpora JPG/PNG/PDF
- **OCR zpracování**: Po nahrání se zavolá edge funkce a zobrazí se dialog s extrahovanými daty k potvrzení/editaci
- **Potvrzení**: Uživatel zkontroluje/upraví údaje a potvrdí uložení
- **Seznam dokladů**: Tabulka s názvem dodavatele, částkou, datem, stavem zaplacení
- **Zaplacení**: Checkbox "Zaplaceno", výběr formy (Moneta/Amnis), datum zaplacení
- **Stažení**: Tlačítko pro stažení souboru přes Blob URL (kompatibilní s preview prostředím)

### 5. Integrace do DealDetail.tsx
Přidání komponenty `<DealSupplierInvoices dealId={deal.id} />` pod existující sekci cestovních dokumentů.

## Uživatelský flow
1. Uživatel nahraje sken/foto faktury
2. Systém zpracuje OCR a zobrazí dialog: dodavatel, částka, datum
3. Uživatel zkontroluje, případně opraví, a potvrdí
4. Doklad se uloží do evidence s možností označit jako zaplacený
5. Kdykoli lze doklad stáhnout zpět do počítače
