-- Smazat duplicitní birthday template 'birthday_client_cz'.
-- V DB už existuje starší 'birthday_greeting' (Lovable seed), který zachováváme.
-- Bez tohoto DELETE by klient dostal dva narozeninové maily.
--
-- POZN.: Migrace 20260424100000_birthday_emails_wiring.sql template seedovala
-- přes INSERT ... ON CONFLICT DO UPDATE. Protože migrace Supabase běží jen jednou
-- (tracked v supabase_migrations.schema_migrations), re-INSERT by se nestal —
-- ale pro jistotu v případě db reset si to tato migrace ošetřuje idempotentně.

DELETE FROM public.email_templates
 WHERE template_key = 'birthday_client_cz';
