# Plán: Změna těla emailu voucheru na jednoduchý text

## Přehled změny

Nahrazení komplexního HTML emailu jednoduchým textovým emailem:

- **Pro klienta (čeština)**: "Vážený {příjmení}, posíláme vám voucher na služby k vašemu zájezdu od {termín od} do {termín do} do hotelu {hotel}."
- **Pro dodavatele (angličtina)**: "Dear valued partner, we are sending to you voucher for our clients for their stay from {Date From} to {Date To} at {hotel}."

## Technické změny

### Edge funkce `send-voucher-email/index.ts`

1. **Odstranit generování HTML** (řádky 138-281)
   - Smazat celou sekci `servicesHtml` a `html` template

2. **Přidat pomocné funkce pro texty**
   ```typescript
   // Český text pro klienta
   const buildClientEmailText = (lastName: string, dateFrom: string, dateTo: string, hotel: string) => {
     return `Vážený ${lastName},
   ```

posíláme vám voucher na služby k vašemu zájezdu od ${dateFrom} do ${dateTo} do hotelu ${hotel}.

S pozdravem,
YARO Travel - Váš specialista na dovolenou
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;

};

// Anglický text pro dodavatele
const buildSupplierEmailText = (dateFrom: string, dateTo: string, hotel: string) => {
return `Dear valued partner,

we are sending to you voucher for our clients for their stay from ${dateFrom} to ${dateTo} at ${hotel}.

Best regards,
YARO Travel
Tel.: +420 602 102 108
Email: zajezdy@yarotravel.cz`;

};

````

3. **Určení dat zájezdu**
- Najít nejranější `dateFrom` a nejpozdější `dateTo` ze služeb voucheru
- Použít hotel z `voucher.hotel_name`

4. **Odeslání dvou samostatných emailů**
- Jeden email klientovi v češtině
- Druhý email dodavateli v angličtině (pokud je `emailCcSupplier` true a dodavatel má email)
- Oba s PDF přílohou

### Logika odesílání

```text
┌─────────────────────────────────────────┐
│         Připravit data voucheru         │
│  (termíny, hotel, příjmení klienta)     │
└─────────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Odeslat email KLIENTOVI (CZ)        │
│  "Vážený {příjmení}, posíláme..."       │
│         + PDF příloha                    │
└─────────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   emailCcSupplier && supplier.email?    │
└────────┬───────────────────────┬────────┘
      │ ANO                   │ NE
      ▼                       ▼
┌────────────────────┐    ┌──────────────┐
│ Odeslat email      │    │   Hotovo     │
│ DODAVATELI (EN)    │    │              │
│ "Dear valued..."   │    │              │
│ + PDF příloha      │    │              │
└────────────────────┘    └──────────────┘
````

## Kompletní změny v kódu

### Soubor: `supabase/functions/send-voucher-email/index.ts`

**Nové pomocné funkce** (před handler):

- `buildClientEmailText()` - český text
- `buildSupplierEmailText()` - anglický text

**Změny v handleru**:

1. Smazat generování `servicesHtml` a `html`
2. Přidat výpočet dat zájezdu ze služeb
3. Změnit odesílání na dva samostatné emaily:
   - Email 1: klient (CZ text)
   - Email 2: dodavatel (EN text) - podmíněně

**Použití `text` místo `html`** v Resend API:

```typescript
const emailPayload = {
  from: "YARO Travel <radek@yarogolf.cz>",
  to: [clientEmail],
  subject: subject,
  text: clientEmailText,  // změna z html na text
  attachments: [...]
};
```

## Očekávané chování po implementaci

| Příjemce  | Jazyk      | Obsah                                              |
| --------- | ---------- | -------------------------------------------------- |
| Klient    | Čeština    | "Vážený {příjmení}, posíláme vám voucher..." + PDF |
| Dodavatel | Angličtina | "Dear valued partner, we are sending..." + PDF     |

## Poznámky

- PDF příloha zůstává beze změny
- Pokud voucher nemá hotel, použije se "N/A" nebo prázdný string
- Předmět emailu zůstává stejný pro obě verze
