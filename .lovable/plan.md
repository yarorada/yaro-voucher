
# Plán: Nastavení odesílání PDF voucheru emailem

## Přehled
Rozšíření stávající funkcionality odesílání voucherů tak, aby bylo možné odeslat PDF verzi voucheru jako přílohu emailu na adresu hlavního klienta.

## Technický přístup

### Problém
Aktuálně se PDF generuje na straně klienta (prohlížeče) pomocí knihovny `html2pdf.js`, která vyžaduje DOM. Edge funkce na serveru nemá přístup k DOM, takže je potřeba zvolit alternativní řešení.

### Navrhované řešení
Použití služby **Puppeteer/Browserless** nebo **pdf-lib** pro server-side generování PDF. Vzhledem k omezením Deno edge functions doporučuji:

**Varianta A (doporučená)**: Generování PDF na klientovi → upload do storage → odeslání z edge funkce
- PDF se vygeneruje v prohlížeči (stávající logika)
- Upload do dočasného Supabase Storage bucketu
- Edge funkce stáhne a připojí k emailu

**Varianta B**: Použití externí API pro PDF generování (např. html2pdf.app, PDFShift)
- Vyžaduje další API klíč

## Implementační kroky

### 1. Databázová migrace
Přidání sloupců pro nastavení emailu do `global_pdf_settings`:
- `email_send_pdf` (boolean) - zda odesílat PDF přílohu
- `email_subject_template` (text) - šablona předmětu emailu
- `email_cc_supplier` (boolean) - kopie dodavateli

### 2. Úprava VoucherDisplay komponenty
- Nová funkce pro generování PDF blobu místo přímého stažení
- Upload PDF do Supabase Storage před odesláním emailu
- Rozšíření dialogu nastavení o email sekci

### 3. Úprava Edge funkce `send-voucher-email`
- Přidání parametru pro URL PDF souboru
- Stažení PDF ze storage
- Připojení PDF jako base64 přílohy přes Resend API
- Vyčištění dočasného souboru po odeslání

### 4. UI komponenty
- Switch pro zapnutí/vypnutí PDF přílohy
- Pole pro úpravu šablony předmětu emailu
- Checkbox pro kopii dodavateli

## Struktura změn

```text
┌─────────────────────────────────────────────────────────┐
│  VoucherDisplay.tsx                                     │
│  ├── Nastavení PDF emailu dialog                        │
│  ├── handleSendEmailWithPdf()                           │
│  │   ├── generatePdfBlob()                              │
│  │   ├── uploadToStorage()                              │
│  │   └── invokeEdgeFunction()                           │
│  └── UI pro zapnutí/vypnutí PDF přílohy                 │
├─────────────────────────────────────────────────────────┤
│  send-voucher-email/index.ts                            │
│  ├── Parametr pdfUrl                                    │
│  ├── Stažení PDF ze storage                             │
│  └── Odeslání s PDF přílohou přes Resend                │
├─────────────────────────────────────────────────────────┤
│  global_pdf_settings (databáze)                         │
│  ├── email_send_pdf: boolean                            │
│  ├── email_subject_template: text                       │
│  └── email_cc_supplier: boolean                         │
└─────────────────────────────────────────────────────────┘
```

## Technické detaily

### Resend API s přílohou
```typescript
await resend.emails.send({
  from: "YARO Travel <zajezdy@yarotravel.cz>",
  to: [clientEmail],
  subject: "Travel Voucher YT-26001",
  html: htmlContent,
  attachments: [{
    filename: "voucher-YT-26001.pdf",
    content: pdfBase64,
  }]
});
```

### Storage bucket
Vytvoření nového bucketu `voucher-pdfs` pro dočasné ukládání PDF souborů před odesláním.

## Odhad práce
- Databázová migrace: 5 min
- Frontend komponenty: 30 min
- Edge funkce úprava: 20 min
- Storage nastavení: 10 min
- Testování: 15 min
