-- Birthday e-mails: napojení edge funkce auto-triggered-emails na pg_cron.
--   1) seed default 'email_templates' řádek pro trigger_type='birthday' (pokud chybí),
--   2) odstranění starší/duplicitní funkce process_birthday_bonuses(BOOLEAN) z Lovable migrací
--      (kvůli které se připisovalo 100 b místo 1500),
--   3) přepnutí stávajícího cron jobu 'process_birthday_bonuses_daily' z BOOLEAN verze
--      na no-arg verzi (1500 b, kind='earn'),
--   4) Lovable má už cron 'auto-triggered-emails-daily' (08:00 UTC) — nezakládáme vlastní,
--      aby se mail neposlal dvakrát denně.
--
-- POZN.: RESEND_API_KEY a LOVABLE_API_KEY musí být nastavené v Supabase secrets ručně
--       (nedá se to udělat z migrace).

-- 1) Seed birthday template ---------------------------------------------------
INSERT INTO public.email_templates (template_key, name, subject, body, trigger_type, is_active)
VALUES (
  'birthday_client_cz',
  'Narozeninové přání – klient (čeština)',
  'Všechno nejlepší k narozeninám 🎂',
  E'{{salutation}},\n\n' ||
  E'dovolte nám popřát vám vše nejlepší k narozeninám – pevné zdraví, hodně štěstí a spoustu krásných cest.\n\n' ||
  E'Jako malý dárek jsme vám právě připsali do vaší věrnostní peněženky 1 500 bodů (1 bod = 1 Kč slevy), které můžete uplatnit při své příští rezervaci v průběhu následujícího roku.\n\n' ||
  E'Těšíme se, že pro vás brzy připravíme další nezapomenutelný zájezd.\n\n' ||
  E'S pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz',
  'birthday',
  true
)
ON CONFLICT (template_key) DO UPDATE
  SET trigger_type = EXCLUDED.trigger_type,
      is_active = true;

-- 2) Cleanup staré funkce z Lovable migrace (kind='birthday', 100 b) ----------
-- Funkci s parametrem (BOOLEAN) má jiný overload, takže ji musíme dropnout
-- explicitně. Náš proces v migraci 20260423260000 používá no-arg variantu.
DROP FUNCTION IF EXISTS public.process_birthday_bonuses(BOOLEAN);

-- 3) Přepnout existující cron 'process_birthday_bonuses_daily' na no-arg verzi
--    (Lovable verze volala BOOLEAN s 100 body; po dropu funkce výše by cron padal).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed – skipping cron schedule';
    RETURN;
  END IF;

  -- Odstranit starý cron (volal BOOLEAN funkci se 100 body)
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname = 'process_birthday_bonuses_daily';

  -- Naplánovat znovu, ale s no-arg verzí (1500 b, kind='earn')
  PERFORM cron.schedule(
    'process_birthday_bonuses_daily',
    '30 2 * * *',  -- denně 02:30 UTC (jako v migraci 20260423260000)
    $cron$ SELECT public.process_birthday_bonuses(); $cron$
  );
END
$$;

-- 4) Úklid: smazat mrtvé cron joby na neexistující edge funkce
--    (amnis-fetch-transactions a moneta-fetch-transactions edge funkce nejsou v repu)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname IN ('amnis-fetch-transactions-daily', 'moneta-fetch-transactions-daily');
END
$$;
