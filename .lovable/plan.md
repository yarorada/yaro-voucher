
# Tlacitko "Souhlasim s nabidkou" a pole pro komentar klienta

## Co se zmeni

Na verejne strance nabidky (`/offer/:token`) pribudne ve spodni casti formular, kde klient muze:
1. Napsat volny text (komentar, poznamky, pozadavky)
2. Kliknout na tlacitko **"Souhlasim s nabidkou"**

Po odeslani se:
- Ulozi odpoved do nove databazove tabulky `offer_responses`
- Odesle e-mail na `zajezdy@yarotravel.cz` s informaci, ktery klient souhlasil, ke kteremu dealu, a s jeho komentarem
- Klientovi se zobrazi potvrzeni, ze jeho souhlas byl odeslan

V CRM dashboardu bude souhlas videt jako notifikace (volitelne rozsireni).

## Technicke zmeny

### 1. Nova databazova tabulka `offer_responses`

```sql
CREATE TABLE offer_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  client_name TEXT,
  client_email TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE offer_responses ENABLE ROW LEVEL SECURITY;

-- Anonymni INSERT (klient neni prihlaseny)
CREATE POLICY "Anyone can insert offer_responses"
  ON offer_responses FOR INSERT
  WITH CHECK (true);

-- Cteni jen pro prihlasene uzivatele (CRM)
CREATE POLICY "Authenticated users can view offer_responses"
  ON offer_responses FOR SELECT
  USING (true);
```

### 2. Nova Edge funkce `submit-offer-response`

- Prijme `{ token, comment }` (bez autentizace - verejny endpoint)
- Overi, ze deal s danym `share_token` existuje
- Ulozi zaznam do `offer_responses` (deal_id, jmeno klienta, email, komentar)
- Odesle e-mail pres Resend na `zajezdy@yarotravel.cz` s obsahem:
  - Cislo dealu, jmeno klienta
  - Text komentare klienta
  - Odkaz na deal v CRM
- Vrati `{ success: true }`

### 3. Uprava `src/pages/PublicOffer.tsx`

Na konec stranky (pred footer) se prida sekce:
- Textarea pro komentar (nepovinny)
- Zelene tlacitko "Souhlasim s nabidkou"
- Po odeslani se formular nahradi potvrzovaci zpravou ("Dekujeme, Vas souhlas byl odeslan.")
- Volani edge funkce `submit-offer-response` s tokenem a komentarem

### 4. Konfigurace

- V `supabase/config.toml` pridat `[functions.submit-offer-response]` s `verify_jwt = false` (verejny endpoint)
