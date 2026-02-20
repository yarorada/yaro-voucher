

# Automatické odeslání dokumentů 7 dní před odjezdem

## Co se změní

Na detailu obchodního případu přibude přepínač (toggle) "Automaticky odeslat dokumenty před odjezdem". Pokud je zapnutý, systém 7 dní před datem `start_date` automaticky odešle klientovi všechny vouchery a dokumenty k danému OP. Pokud přepínač zapnutý není, nic se neodešle.

## Technické kroky

### 1. Databáze - nový sloupec `auto_send_documents`

Přidáme sloupec `auto_send_documents` (boolean, default `false`) do tabulky `deals`. Tento sloupec určuje, zda se mají dokumenty automaticky odeslat.

Přidáme také sloupec `documents_auto_sent_at` (timestamptz, nullable) pro záznam, že automatické odeslání již proběhlo (prevence opakovaného odeslání).

### 2. UI - přepínač v detailu obchodního případu

V `src/pages/DealDetail.tsx` přidáme přepínač (Switch) do sekce s dokumenty nebo do hlavičky OP:
- Label: "Automaticky odeslat dokumenty 7 dní před odjezdem"
- Uloží se do pole `auto_send_documents` v tabulce `deals`
- Zobrazí se pouze pokud OP má nastavené `start_date` a `clientEmail`

### 3. Edge funkce `auto-send-deal-documents`

Nová CRON edge funkce, která poběží 1x denně:

1. Najde všechny dealy kde:
   - `auto_send_documents = true`
   - `documents_auto_sent_at IS NULL` (ještě nebylo odesláno)
   - `start_date = today + 7 dní`
   - `status` je `confirmed` nebo `dispatched`
2. Pro každý takový deal:
   - Najde lead travelera a jeho email
   - Najde všechny dokumenty z `deal_documents`
   - Najde všechny vouchery z `vouchers` pro daný deal
   - Pro vouchery bez PDF vygeneruje/stáhne PDF
   - Odešle jeden email se všemi přílohami (využije existující logiku z `send-deal-documents`)
   - Nastaví `documents_auto_sent_at` na aktuální čas
3. Zaloguje výsledek

### 4. CRON nastavení

Nastavíme denní spouštění funkce pomocí `pg_cron` + `pg_net` (INSERT do `cron.schedule`).

### 5. Aktualizace types

Soubor `src/integrations/supabase/types.ts` se automaticky aktualizuje po migraci.

## Pořadí implementace

1. Migrace DB (nové sloupce `auto_send_documents`, `documents_auto_sent_at`)
2. UI toggle v `DealDetail.tsx`
3. Edge funkce `auto-send-deal-documents`
4. CRON job registrace
5. Konfigurace v `supabase/config.toml`
