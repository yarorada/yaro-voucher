
# Plán: Správa úrovní přístupu a přepínač rozsahu dat

## Co bude přidáno

### 1. Přepínač "Rozsah dat" per uživatel
Každý uživatel bude mít nové nastavení:
- **Všechna data** — vidí záznamy všech kolegů (výchozí pro Admin a "Bez role")
- **Pouze vlastní data** — vidí pouze záznamy, které sám vložil (výchozí pro Prodejce)

Toto nastavení bude uloženo v nové tabulce `user_data_scope` a správce ho může u každého uživatele přepnout v rozhraní `/admin/roles`.

### 2. Rozšíření sekce oprávnění v UI
V rozbalitelné části každého uživatele přibude nová vizuální sekce **"Rozsah přístupu k datům"** s přepínačem, oddělenou od přepínačů sekcí.

### 3. Vynucení rozsahu dat v kódu (hook)
Nový hook `useDataScope` vrátí aktuálnímu přihlášenému uživateli jeho nastavení (`own` nebo `all`). Tento hook bude použit na místech, kde se data filtrují — primárně v komponentách se seznamy (Deals, Clients, Vouchers, Contracts).

---

## Technické změny

### Databáze (migrace)
Nová tabulka `user_data_scope`:
```sql
CREATE TABLE public.user_data_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'all', -- 'all' | 'own'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_data_scope ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage data scope"
  ON public.user_data_scope FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can read own scope
CREATE POLICY "Users can view own scope"
  ON public.user_data_scope FOR SELECT
  USING (auth.uid() = user_id);
```

### Nový hook: `src/hooks/useDataScope.tsx`
- Načte záznam z `user_data_scope` pro aktuálního uživatele
- Vrátí `scope: 'all' | 'own'`
- Prodejce bez záznamu = defaultně `'own'`, ostatní = `'all'`

### Rozšíření `useUserPermissionsForUser`
- Přidání metod `getDataScope()` a `setDataScope(scope)` pro admin UI

### Úprava `src/pages/AdminRoles.tsx`
V rozbalitelné části každého uživatele přibude sekce:

```
┌─────────────────────────────────────────────┐
│ Rozsah přístupu k datům                     │
│                                             │
│ ○ Všechna data   ● Pouze vlastní data       │
│                                             │
│ [popis aktuálního nastavení]                │
└─────────────────────────────────────────────┘
```

### Vynucení v seznamech dat
Hook `useDataScope` bude použit na těchto stránkách:
- `src/pages/Deals.tsx` — filtr deals
- `src/pages/Clients.tsx` — filtr klientů
- `src/pages/VouchersList.tsx` — filtr voucherů
- `src/pages/Contracts.tsx` — filtr smluv

Když `scope === 'own'`, do Supabase dotazů bude přidán filtr `.eq('user_id', user.id)`. Když `scope === 'all'`, filtr se neaplikuje.

---

## Výchozí hodnoty dle role

| Role | Výchozí rozsah dat |
|------|-------------------|
| admin | Všechna data |
| prodejce | Pouze vlastní data |
| bez role | Všechna data |

Pokud v tabulce `user_data_scope` není záznam pro daného uživatele, aplikuje se výchozí hodnota dle role.

---

## Souhrn souborů ke změně / vytvoření

- `supabase/migrations/...` — nová tabulka `user_data_scope`
- `src/hooks/useDataScope.tsx` — nový hook
- `src/hooks/useUserPermissions.tsx` — rozšíření `useUserPermissionsForUser` o data scope
- `src/pages/AdminRoles.tsx` — UI přepínač rozsahu dat
- `src/pages/Deals.tsx` — aplikace data scope filtru
- `src/pages/Clients.tsx` — aplikace data scope filtru
- `src/pages/VouchersList.tsx` — aplikace data scope filtru
- `src/pages/Contracts.tsx` — aplikace data scope filtru
