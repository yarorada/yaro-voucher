
# Úprava anglického textu emailu pro dodavatele

## Současný stav
Aktuální text v `supabase/functions/send-voucher-email/index.ts` (řádky 32-42):

```typescript
const buildSupplierEmailText = (dateFrom: string, dateTo: string, hotel: string) => {
  return `Dear valued partner,

we are sending to you voucher for our clients for their stay from ${dateFrom} to ${dateTo} at ${hotel}.

Best regards,
YARO Travel
Tel.: +420 602 102 108
Email: zajezdy@yarotravel.cz`;
};
```

## Navrhovaná změna
Přidání zmínky o příloze na samostatný řádek:

```typescript
const buildSupplierEmailText = (dateFrom: string, dateTo: string, hotel: string) => {
  return `Dear valued partner,

we are sending to you voucher for our clients for their stay from ${dateFrom} to ${dateTo} at ${hotel}.

Please find the voucher attached.

Best regards,
YARO Travel
Tel.: +420 602 102 108
zajezdy@yarotravel.cz`;
};
```

## Změny
- Přidán nový řádek: `Please find the voucher attached.`
- Odstraněno `Email:` před kontaktní adresou (čistší formát)

## Soubor k úpravě
`supabase/functions/send-voucher-email/index.ts` - funkce `buildSupplierEmailText`
