
## Finální plán implementace – E-mailová komunikace v OP

Jsem v plan módu – nemohu přímo provádět změny. Níže je kompletní plán připravený pro implementační mód.

---

### Co se implementuje (6 kroků)

**1. Databázová migrace**

```sql
-- Tabulka deal_emails
CREATE TABLE public.deal_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  message_id text UNIQUE,
  thread_id text,
  subject text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] DEFAULT '{}',
  cc_emails text[] DEFAULT '{}',
  body_text text,
  body_html text,
  sent_at timestamptz,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  in_reply_to text,
  references_header text,
  is_read boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]',
  source text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.deal_emails(deal_id, sent_at DESC);
CREATE INDEX ON public.deal_emails(from_email);
ALTER TABLE public.deal_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do all on deal_emails" ON public.deal_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabulka unmatched_emails
CREATE TABLE public.unmatched_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE,
  subject text,
  from_email text,
  from_name text,
  body_text text,
  body_html text,
  sent_at timestamptz,
  raw_payload jsonb,
  received_at timestamptz DEFAULT now(),
  assigned_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL
);
ALTER TABLE public.unmatched_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do all on unmatched_emails" ON public.unmatched_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill existujících emailů z email_log
INSERT INTO public.deal_emails (deal_id, message_id, subject, from_email, sent_at, direction, is_read, source, body_text)
SELECT
  el.deal_id,
  'emaillog-' || el.id::text,
  COALESCE(et.subject, 'Odeslaný email'),
  el.recipient_email,
  el.sent_at,
  'outbound',
  true,
  'email_log',
  NULL
FROM public.email_log el
LEFT JOIN public.email_templates et ON et.id = el.template_id
WHERE el.deal_id IS NOT NULL
ON CONFLICT (message_id) DO NOTHING;
```

**2. Secret `EMAIL_INBOUND_SECRET`**
Přidat do Supabase secrets – hodnota bude moci být generována a zobrazena uživateli po implementaci.

**3. `supabase/config.toml`** – přidat:
```toml
[functions.email-inbound-webhook]
verify_jwt = false

[functions.send-deal-email]
verify_jwt = true
```

**4. Edge Function `email-inbound-webhook/index.ts`**
- Ověří `X-Webhook-Secret` header
- Auto-detekce formátu (MIME vs JSON)
- Jednoduchý MIME parser pro extrakci From/To/Subject/body
- Matching z from_email na `clients.email` → `deal_travelers` → `deal_id`
- INSERT do `deal_emails` nebo `unmatched_emails`

**5. Edge Function `send-deal-email/index.ts`**
- JWT validace přes `supabaseAdmin.auth.getUser(token)`
- Resend API call s headers pro threading
- INSERT do `deal_emails` (outbound)

**6. `src/components/DealEmailThread.tsx`**
- `useQuery` pro načtení deal_emails (seřazeno sent_at ASC)
- Thread view: příchozí (vlevo, šedé), odchozí (vpravo, modré)
- Inline composer (nový email / reply)
- `useMutation` pro volání `send-deal-email`
- Expand/collapse zpráv > 400 znaků
- Auto-mark as read při otevření
- Sekce nepřiřazených emailů

**7. `src/pages/DealDetail.tsx`**
- Import `DealEmailThread`
- Přidat `<DealEmailThread dealId={deal.id} />` za `<DealSupplierInvoices dealId={deal.id} />`

---

### Soubory

| # | Soubor | Akce |
|---|---|---|
| 1 | Migrace SQL | Nový |
| 2 | `supabase/config.toml` | Upravit |
| 3 | `supabase/functions/email-inbound-webhook/index.ts` | Nový |
| 4 | `supabase/functions/send-deal-email/index.ts` | Nový |
| 5 | `src/components/DealEmailThread.tsx` | Nový |
| 6 | `src/pages/DealDetail.tsx` | Upravit |
