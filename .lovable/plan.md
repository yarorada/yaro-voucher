

# Oprava: Nelze vybrat variantu jako finalni

## Problem

Databazova funkce `select_deal_variant` kontroluje, zda prihlaseny uzivatel je vlastnikem **varianty** (`deal_variants.user_id`). Ale nektere varianty byly vytvoreny jinym uzivatelem nez tim, kdo se pokusi variantu vybrat. Napr. varianta "Sueno Golf Hotel" ma `user_id` jineho uzivatele nez je vlastnik dealu.

RLS politiky na tabulce `deal_variants` pritom povolují update vsem prihlasenym uzivatelum -- funkce je tedy zbytecne restriktivni.

## Reseni

Upravit databazovou funkci `select_deal_variant` tak, aby kontrolovala vlastnictvi **dealu** (ne varianty), nebo aby jednodusse povolila operaci kazdemu prihlaseneho uzivateli (coz odpovida existujicim RLS politikam).

## Technicke zmeny

### 1. Migrace - uprava funkce `select_deal_variant`

Zmena kontroly z `v_user_id != auth.uid()` na overeni, ze uzivatel je autentifikovany (coz uz funkce dela). Odstraníme kontrolu vlastnictvi varianty, protoze RLS politiky uz umoznuji update vsem prihlasenym uzivatelum.

```sql
CREATE OR REPLACE FUNCTION public.select_deal_variant(p_variant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT deal_id INTO v_deal_id
  FROM deal_variants
  WHERE id = p_variant_id;

  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  UPDATE deal_variants SET is_selected = false WHERE deal_id = v_deal_id;
  UPDATE deal_variants SET is_selected = true WHERE id = p_variant_id;

  RETURN true;
END;
$$;
```

Zadne zmeny ve frontendu nejsou potreba -- kod v `DealVariants.tsx` uz vola `supabase.rpc("select_deal_variant", ...)` spravne.
