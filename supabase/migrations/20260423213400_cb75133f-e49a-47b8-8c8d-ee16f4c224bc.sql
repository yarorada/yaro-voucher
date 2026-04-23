-- Peněženka klienta: oprava narozeninového bonusu — dorovnání na 1500 bodů.
-- Pro každou existující transakci 'Narozeninový bonus YYYY-MM-DD' s bodovou
-- hodnotou <> 1500 vložíme 'adjust' s dorovnáním. Ponecháváme původní řádek
-- beze změny (ledger je immutable).

DO $$
DECLARE
  v_rec RECORD;
  v_diff INTEGER;
BEGIN
  FOR v_rec IN
    SELECT id, client_id, points, notes
      FROM public.client_wallet_transactions
     WHERE notes LIKE 'Narozeninový bonus %'
       AND points <> 1500
       AND points > 0
  LOOP
    v_diff := 1500 - v_rec.points;
    IF v_diff <> 0 THEN
      INSERT INTO public.client_wallet_transactions
        (client_id, points, kind, notes)
      VALUES (
        v_rec.client_id,
        v_diff,
        'adjust',
        format('Dorovnání narozeninového bonusu na 1500 (dříve %s b)', v_rec.points)
      );
    END IF;
  END LOOP;
END $$;