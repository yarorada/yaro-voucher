

# Centralizovaný systém e-mailových šablon

## Co se zmeni

Vytvorime databazovou tabulku pro e-mailove sablony, UI stranku pro jejich spravu a napojime existujici odesilaci funkce (send-voucher-email, send-contract-email, send-deal-documents) tak, aby nacitaly sablony z databaze misto hardcoded textu.

## 1. Databaze

Vytvorime tabulku `email_templates` se sloupci:
- `id` (UUID, PK)
- `template_key` (text, unikatni) -- napr. "voucher_client_cz", "contract_client_cz", "contract_supplier_en"
- `name` (text) -- lidsky citelny nazev sablony
- `subject` (text) -- predmet emailu s placeholdery
- `body` (text) -- telo emailu s placeholdery
- `trigger_type` (text, nullable) -- napr. "manual", "before_departure", "after_return", "payment_received"
- `trigger_offset_days` (integer, nullable) -- pocet dni pred/po udalosti
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Tabulku naplnime vychozimi sablonami z aktualnich hardcoded textu (voucher klient CZ, voucher dodavatel EN, smlouva klient CZ, smlouva dodavatel EN).

Vytvorime tabulku `email_log` pro sledovani odeslanych emailu:
- `id`, `template_id`, `deal_id`, `contract_id`, `voucher_id`, `recipient_email`, `sent_at`, `status`

## 2. UI -- Nova stranka "E-mailove sablony"

Pristupna z bocniho menu. Zobrazi seznam vsech sablon s moznosti:
- Editovat predmet a telo
- Zobrazit dostupne placeholdery: `{{first_name}}`, `{{last_name}}`, `{{destination}}`, `{{hotel}}`, `{{date_from}}`, `{{date_to}}`, `{{total_price}}`, `{{voucher_code}}`, `{{contract_number}}`, `{{sign_link}}`
- Nahled vyrenderovane sablony
- Aktivovat/deaktivovat sablonu

## 3. Edge funkce -- napojeni na sablony

Upravime `send-voucher-email`, `send-contract-email` a `send-deal-documents` tak, aby:
1. Nacetly sablonu z DB podle `template_key`
2. Nahradily placeholdery skutecnymi hodnotami
3. Pouzily defaultni hardcoded text jako fallback pokud sablona neexistuje
4. Zaznamenaly odeslani do `email_log`

## 4. Navigace

Pridame odkaz "E-maily" do `AppSidebar.tsx` (sekce Nastaveni nebo samostatna polozka).

---

## Technicke detaily

### Soubory k vytvoreni:
- `src/pages/EmailTemplates.tsx` -- stranka se spravou sablon
- Migrace pro tabulky `email_templates` a `email_log`

### Soubory k uprave:
- `src/App.tsx` -- nova routa `/email-templates`
- `src/components/AppSidebar.tsx` -- odkaz v menu
- `supabase/functions/send-voucher-email/index.ts` -- nacteni sablony z DB
- `supabase/functions/send-contract-email/index.ts` -- nacteni sablony z DB
- `supabase/functions/send-deal-documents/index.ts` -- nacteni sablony z DB

### Vychozi sablony (seed data):

| template_key | Pouziti |
|---|---|
| voucher_client_cz | Voucher -- klient (cestina) |
| voucher_supplier_en | Voucher -- dodavatel (anglictina) |
| contract_client_cz | Smlouva -- klient (cestina) |
| contract_supplier_en | Smlouva -- dodavatel (anglictina) |
| deal_docs_client_cz | Dokumenty k dealu -- klient |

