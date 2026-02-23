

# Sloučení uživatelů: propojení Apple identity k hlavnímu účtu

## Situace

- **Hlavní účet**: `radek@yarotravel.cz` (ID: `c744a7af-...`, vytvořen 22.10.2025, veškerá data)
- **Apple účet**: `8xxyq7v4br@privaterelay.appleid.com` (ID: `a8a9f7f4-...`, vytvořen dnes, 0 dat)

Apple účet nemá žádné záznamy (vouchery, dealy, smlouvy, varianty, úkoly) -- je zcela prázdný.

## Postup

Protože Apple účet neobsahuje žádná data, stačí:

1. **Smazat Apple účet** z autentizační tabulky a profilu
2. **Smazat profil** Apple uživatele z tabulky `profiles`

To se provede jedinou SQL migrací:

```sql
-- Smazat profil Apple uzivatele
DELETE FROM public.profiles WHERE id = 'a8a9f7f4-7586-4c78-ac04-3f6030c3a05b';

-- Smazat Apple uzivatele z auth
DELETE FROM auth.users WHERE id = 'a8a9f7f4-7586-4c78-ac04-3f6030c3a05b';
```

Po smazání, když se Radek příště přihlásí přes Apple, systém automaticky vytvoří novou identitu propojenou s existujícím účtem (pokud má Apple nakonfigurovaný stejný e-mail), nebo vytvoří nový účet, který pak bude potřeba znovu propojit.

## Alternativní přístup (lepší dlouhodobě)

Pokud chcete, aby se Radek mohl přihlašovat přes Apple **i** přes e-mail pod jedním účtem, je lepší řešení nakonfigurovat Apple Sign-In tak, aby sdílel skutečný e-mail (`radek@yarotravel.cz`) místo Apple relay adresy. To ale závisí na nastavení Apple ID na straně uživatele.

## Technické detaily

- Migrace smaže pouze prázdný Apple účet
- Hlavní účet `radek@yarotravel.cz` zůstane beze změn
- Žádné změny ve frontendu nejsou potřeba

