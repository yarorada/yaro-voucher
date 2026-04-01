

## Oprava odesílání vydaných faktur e-mailem

### Problém
Edge funkce `send-invoice-email` používá connector gateway (`connector-gateway.lovable.dev/resend`), ale projekt nemá připojený Resend connector. Logy ukazují chybu: `"Credential not found", source: "connectors_gateway"`.

### Řešení
Přepsat edge funkci tak, aby volala Resend API přímo (bez gateway), protože `RESEND_API_KEY` je již uložen v secrets.

### Změny

**1. `supabase/functions/send-invoice-email/index.ts`**
- Nahradit volání `connector-gateway.lovable.dev/resend/emails` přímým voláním `https://api.resend.com/emails`
- Použít `RESEND_API_KEY` přímo v `Authorization: Bearer` headeru
- Odstranit závislost na `LOVABLE_API_KEY` a `X-Connection-Api-Key`

Klíčová změna:
```typescript
// Místo gateway:
const emailResponse = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resendApiKey}`,
  },
  body: JSON.stringify({
    from: "YARO Travel <zajezdy@yarotravel.cz>",
    to: [recipientEmail],
    subject,
    html: body.replace(/\n/g, "<br>"),
  }),
});
```

**2. Redeploy edge funkce** po úpravě.

### Technické detaily
- `RESEND_API_KEY` secret existuje a je nastaven
- Přímé volání Resend API obchází gateway a eliminuje chybu "Credential not found"
- Žádné změny v klientském kódu (`Invoicing.tsx`) nejsou potřeba

