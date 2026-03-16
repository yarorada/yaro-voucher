
## Analýza současného stavu

**Problém:** Aktuální systém má jeden dialog "Odeslat dokumenty" s možností výběru příjemce (klient / klient+dodavatel / dodavatel), ale:
- Dodavateli se odesílají VŠECHNY vybrané dokumenty, ne jen jeho voucher
- Není žádné oddělení: klient = česky, dodavatel = anglicky
- Pro každého dodavatele by měl jít pouze voucher patřící jemu
- UI nedává jasně najevo, co půjde komu

**Nový flow:**
1. **Tlačítko "Odeslat klientovi"** → otevře dialog jen s klientskými dokumenty (všechny vouchery + soubory), česky předvyplněný text
2. **Tlačítko "Odeslat dodavatelům"** → nový dialog, kde každý dodavatel vidí POUZE svůj voucher, anglicky předvyplněný text, odesílá se separátně každému dodavateli

---

## Plán implementace

### 1. Nová logika odesílání v `DealDocumentsSection.tsx`

**Stav:**
- Přidat `supplierSendDialogOpen` + `selectedSupplierVouchers` pro supplier dialog
- Oddělit `openSendDialog` na dvě funkce: `openClientDialog()` a `openSupplierDialog()`

**Client dialog (nový):**
- Výběr: všechny dokumenty + všechny vouchery (defaultně vše zaškrtnuto)
- E-mail klienta předvyplněn
- Text předvyplněn **česky**: `Vážený/á [jméno], v příloze zasíláme cestovní dokumenty...`
- Odesílá se 1 e-mail na klienta

**Supplier dialog (nový):**
- Zobrazí seznam dodavatelů z voucherů (groupované podle supplier_id)
- Pro každého dodavatele: jeho název + e-mail + seznam jeho voucherů s checkboxem
- Možnost upravit anglický text e-mailu
- Odesílá se separátně na každého dodavatele pouze s jeho vouchery
- Text předvyplněn **anglicky**: `Dear [supplier name], please find attached the travel voucher(s) for your records...`

### 2. Nová funkce `handleSendToSuppliers()`

```text
Pro každého dodavatele (s e-mailem) zvlášť:
  - Vybrat jen vouchery patřící tomuto dodavateli (supplier_id === dodavatel.id)
  - Vygenerovat PDF pro tyto vouchery (in-memory)
  - Zavolat send-deal-documents edge funkci s:
      clientEmail = dodavatel.email
      emailBody = anglický text
      emailSubject = anglický subject
      inlineAttachments = jen jeho vouchery
  - Po úspěchu: označit jeho vouchery jako sent_at
```

### 3. UI změny – hlavičkové tlačítko

Stávající dropdown "Odeslat ▼" se změní na dvě oddělená tlačítka:
```text
[👤 Klientovi]  [🏢 Dodavatelům]
```
Tlačítko "Dodavatelům" se zobrazí pouze pokud existují vouchery s dodavatelem + e-mailem.

### 4. Edge funkce `send-deal-documents/index.ts`

Stávající funkce je OK – posílá jeden e-mail na `clientEmail` s přílohami. Stačí ji volat zvlášť pro každého dodavatele.

Mírná úprava: odstranit validaci `if (!clientEmail)` → přejmenovat parametr na `recipientEmail` (nebo uvolnit validaci), aby šlo poslat i dodavateli bez nutnosti posílat klientovi.

---

## Přehled změn

| Soubor | Co se mění |
|---|---|
| `src/components/DealDocumentsSection.tsx` | Nový supplier dialog, oddělené send funkce, nové UI tlačítka |
| `supabase/functions/send-deal-documents/index.ts` | Uvolnit validaci `clientEmail` → `recipientEmail` |

---

## Nový dialog pro dodavatele (wireframe)

```text
┌─────────────────────────────────────────┐
│ Odeslat vouchery dodavatelům            │
├─────────────────────────────────────────┤
│ ☑ Golf Club Algarve (golf@algarve.com)  │
│   └─ [✓] Voucher YT-26001 – Jan Novák  │
│                                          │
│ ☑ Hotel Marina (info@marina.com)        │
│   └─ [✓] Voucher YT-26002 – Jan Novák  │
│                                          │
│ Předmět (EN):                           │
│ [Travel Documents – YARO Travel       ] │
│                                          │
│ Text e-mailu (EN):                      │
│ [Dear ...,                            ] │
│ [please find attached...              ] │
├─────────────────────────────────────────┤
│ [Zrušit]              [Odeslat všem]   │
└─────────────────────────────────────────┘
```

Každý dodavatel dostane svůj vlastní e-mail – pouze s jeho vouchery.
