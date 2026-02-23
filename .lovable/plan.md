

# Oprava: Vybraná varianta se nezapisuje jako finální

## Problem

Databazova funkce `select_deal_variant` obsahuje kontrolu `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'`. Edge funkce `submit-offer-response` ale pouziva service role klient (bez prihlaseneho uzivatele), takze `auth.uid()` je vzdy NULL a volani selze s chybou "Authentication required".

## Reseni

Upravit databazovou funkci `select_deal_variant` tak, aby povolila volani i z service role kontextu. Misto kontroly `auth.uid()` zkontrolujeme, zda je volajici bud autentifikovany uzivatel NEBO service role.

## Technicke zmeny

### 1. Migrace -- uprava funkce `select_deal_variant`

Nahradit podmínku:
```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required';
END IF;
```

Za:
```sql
IF auth.uid() IS NULL AND current_setting('role', true) != 'service_role' THEN
  RAISE EXCEPTION 'Authentication required';
END IF;
```

Tím se umožní volání jak od přihlášených uživatelů (přes UI), tak z edge funkcí běžících pod service role (automatické schválení klientem).

### Soubory k uprave

- **Nova migrace** -- `ALTER FUNCTION select_deal_variant` s upravenou autorizacni logikou

Zadne zmeny v edge funkcich ani frontendu nejsou potreba.
