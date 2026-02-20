

# Implementace: Automatické odeslání dokumentů 7 dní před odjezdem

## Stav
DB migrace (sloupce `auto_send_documents` a `documents_auto_sent_at`) je hotová. Zbývá UI, edge funkce a CRON.

## 1. UI toggle v DealDocumentsSection

**Soubor:** `src/components/DealDocumentsSection.tsx`

- Přidat importy: `Switch` z ui, ikonu `Clock`
- Rozšířit props interface o `startDate`, `autoSendDocuments`, `documentsAutoSentAt`
- Před upload zónu vložit toggle blok:
  - Zobrazí se pouze pokud existuje `startDate` a `clientEmail`
  - Switch uloží hodnotu přímo do DB (`deals.auto_send_documents`)
  - Pokud už bylo odesláno (`documentsAutoSentAt`), switch je disabled a zobrazí se zelený text s datem odeslání
  - Po změně vyvolá event `deal-updated` pro refresh rodičovské stránky

**Soubor:** `src/pages/DealDetail.tsx`

- Předat nové props do `<DealDocumentsSection>`:
  - `startDate={deal.start_date}`
  - `autoSendDocuments={(deal as any).auto_send_documents}`
  - `documentsAutoSentAt={(deal as any).documents_auto_sent_at}`
- Přidat listener na `deal-updated` event pro refresh dat

## 2. Edge funkce `auto-send-deal-documents`

**Soubor:** `supabase/functions/auto-send-deal-documents/index.ts`

Logika:
1. Inicializace Supabase service role klienta
2. Vypočítat datum `today + 7 dní`
3. Dotaz na deals kde:
   - `auto_send_documents = true`
   - `documents_auto_sent_at IS NULL`
   - `start_date = targetDate`
   - `status IN ('confirmed', 'dispatched')`
4. Pro každý deal:
   - Najít lead travelera a jeho email z `deal_travelers` + `clients`
   - Načíst dokumenty z `deal_documents`
   - Načíst vouchery z `vouchers` pro deal
   - Pro vouchery stáhnout PDF z `voucher-pdfs` storage (pokud existuje `sent_at`)
   - Odeslat email přes Resend API se všemi přílohami
   - BCC na `zajezdy@yarotravel.cz`
   - Nastavit `documents_auto_sent_at = now()`
5. Zalogovat výsledky

Funkce bude `verify_jwt = false` (volá ji CRON).

## 3. Konfigurace v `supabase/config.toml`

Přidat:
```
[functions.auto-send-deal-documents]
verify_jwt = false
```

## 4. CRON job registrace

SQL příkaz (přes insert tool, ne migraci):
- Denní spouštění v 7:00 UTC (9:00 CET)
- Volá edge funkci `auto-send-deal-documents` přes `pg_net`

## Pořadí implementace

1. Upravit `DealDocumentsSection.tsx` (toggle UI)
2. Upravit `DealDetail.tsx` (předání props)
3. Vytvořit edge funkci `auto-send-deal-documents`
4. Aktualizovat `supabase/config.toml`
5. Registrovat CRON job

