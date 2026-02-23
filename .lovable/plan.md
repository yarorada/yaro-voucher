
# Oznamovaci centrum (Notification Center)

## Prehled

Vytvorim centralni oznamovaci centrum, ktere bude sbirat vsechny automaticke udalosti v systemu. V headeru vedle breadcrumbs se objevi ikona zvonecku s pocitadlem neprectenych oznameni. Po kliknuti se otevre panel se seznamem udalosti.

## Typy udalosti, ktere se budou zaznamenavat

- **offer_approved** -- Klient schvalil nabidku (z `submit-offer-response`)
- **payment_confirmed** -- Platba byla sparovana a potvrzena (z `confirm-payment-match`)
- **deal_status_changed** -- Automaticka zmena statusu dealu (z `auto-dispatch-deals`, `confirm-payment-match`)
- **email_sent** -- Automaticky odeslany email klientovi (z `auto-triggered-emails` -- narozeniny, pripominka platby, pred odjezdem, po navratu)
- **documents_auto_sent** -- Automaticke odeslani dokumentu pred odjezdem (z `auto-send-deal-documents`)
- **contract_signed** -- Klient podepsal smlouvu online (z `sign-contract`)

## Technicke zmeny

### 1. Nova databazova tabulka `notifications`

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  event_type text NOT NULL,       -- offer_approved, payment_confirmed, deal_status_changed, email_sent, documents_auto_sent, contract_signed
  title text NOT NULL,
  message text,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES travel_contracts(id) ON DELETE SET NULL,
  link text                       -- relativni odkaz v CRM, napr. /deals/uuid
);
```

RLS politiky: SELECT a UPDATE (pro oznaceni jako prectene) pro autentifikovane uzivatele. INSERT pouze pres service role (edge funkce).

Realtime bude zapnuty pro tuto tabulku, aby se nova oznameni zobrazovala okamzite.

### 2. Uprava edge funkci -- pridani zapisu do `notifications`

Kazda z nasledujicich funkci bude po sve akci vkladat radek do tabulky `notifications`:

- **submit-offer-response** -- po schvaleni nabidky: "Klient Novak schvalil nabidku D-260012"
- **confirm-payment-match** -- po potvrzeni platby: "Platba 15 000 Kc sparovana se smlouvou CS-260011"
- **auto-dispatch-deals** -- po zmene statusu: "Deal D-260010 automaticky prepnut na Odbaveno"
- **auto-triggered-emails** -- po odeslani mailu: "Odeslano prani k narozeninam pro Jan Novak"
- **auto-send-deal-documents** -- po odeslani dokumentu: "Dokumenty automaticky odeslany pro D-260008"
- **sign-contract** -- po podpisu: "Smlouva CS-260005 podepsana klientem online"

### 3. Nova komponenta `NotificationBell` v headeru

- Ikona zvonecku (Bell z lucide-react) v headeru vedle breadcrumbs
- Badge s poctem neprectenych oznameni
- Po kliknuti se otevre Popover se seznamem oznameni (max 20 poslednich)
- Kazde oznameni zobrazuje ikonu dle typu, titulek, cas a odkaz na prislusny deal/smlouvu
- Tlacitko "Oznacit vse jako prectene"
- Neprectena oznameni jsou vizualne zvyraznena

### 4. Realtime subscripce

Komponenta se prihlasi k realtime zmenam na tabulce `notifications`, takze nova oznameni se zobrazi okamzite bez nutnosti refreshe stranky.

### 5. Uprava `LayoutHeader` v `App.tsx`

Pridani `NotificationBell` komponenty do headeru mezi breadcrumbs a toolbar content.

## Soubory k vytvoreni/uprave

- **Nova migrace** -- tabulka `notifications` + RLS + realtime
- **Novy soubor** `src/components/NotificationBell.tsx` -- komponenta zvonecku s popoverem
- **Uprava** `src/App.tsx` -- pridani NotificationBell do LayoutHeader
- **Uprava** `supabase/functions/submit-offer-response/index.ts` -- insert do notifications
- **Uprava** `supabase/functions/confirm-payment-match/index.ts` -- insert do notifications
- **Uprava** `supabase/functions/auto-dispatch-deals/index.ts` -- insert do notifications
- **Uprava** `supabase/functions/auto-triggered-emails/index.ts` -- insert do notifications
- **Uprava** `supabase/functions/auto-send-deal-documents/index.ts` -- insert do notifications
- **Uprava** `supabase/functions/sign-contract/index.ts` -- insert do notifications
