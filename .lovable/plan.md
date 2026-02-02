
# Plán: Nastavení odesílání PDF voucheru emailem ✅ DOKONČENO

## Přehled
Rozšíření stávající funkcionality odesílání voucherů tak, aby bylo možné odeslat PDF verzi voucheru jako přílohu emailu na adresu hlavního klienta.

## Implementováno

### 1. Databázová migrace ✅
Přidány sloupce do `global_pdf_settings`:
- `email_send_pdf` (boolean) - zda odesílat PDF přílohu
- `email_subject_template` (text) - šablona předmětu emailu
- `email_cc_supplier` (boolean) - kopie dodavateli

Vytvořen storage bucket `voucher-pdfs` s RLS politikami.

### 2. VoucherDisplay komponenta ✅
- Přidáno UI pro nastavení emailu v dialogu Nastavení PDF
- Implementována funkce `generatePdfBlob()` pro generování PDF
- Implementována funkce `uploadPdfToStorage()` pro upload do storage
- Upravena funkce `handleSendEmail()` pro podporu PDF přílohy

### 3. Edge funkce `send-voucher-email` ✅
- Přidán parametr `pdfPath` pro cestu k PDF souboru
- Stažení PDF ze storage
- Připojení PDF jako base64 přílohy přes Resend API
- Automatické vyčištění dočasného souboru po odeslání
- Podpora vlastní šablony předmětu emailu
- Možnost vypnout kopii dodavateli

## Použití
1. Otevřete voucher
2. Klikněte na ikonu nastavení (ozubené kolo)
3. V sekci "Nastavení emailu" zapněte "Přiložit PDF k emailu"
4. Volitelně upravte předmět emailu a kopii dodavateli
5. Klikněte na tlačítko email pro odeslání
