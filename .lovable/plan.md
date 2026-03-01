
## Barevné indikátory expirace dokladů u klientů

### Co se změní

V sekci Klienti, v tabulce vedle jména každého klienta, přibudou barevné odznak/chip pro pas a občanský průkaz. Barva odznaku bude odrážet stav platnosti dokladu.

### Barevná logika

| Stav | Barva | Podmínka |
|---|---|---|
| Expirováno | Červená | Datum expirace je v minulosti, nebo do 30 dnů |
| Brzy expiruje | Oranžová | Do 90 dnů |
| Upozornění | Žlutá | Do 180 dnů |
| Platný | Zelená/Výchozí (modrá) | Více než 180 dnů |

### Technické detaily

**Soubor:** `src/pages/Clients.tsx`

1. Přidat pomocnou funkci `getExpiryStatus(dateStr: string | null)`, která vrací `'expired' | 'critical' | 'warning' | 'notice' | 'ok' | null`.

2. Nahradit stávající pevně modrý odznak `PAS` dynamickým odznakem, jehož barva závisí na výsledku `getExpiryStatus(client.passport_expiry)`.

3. Přidat podobný odznak pro občanský průkaz `OP`, pokud je vyplněno `id_card_number`.

4. Pokud klient nemá vyplněno datum expirace, ale má číslo dokladu, zobrazit neutrální šedý odznak (jako dosud – bez indikace expirace).

```text
Jméno klienta  [PAS]  [OP]
               ↑       ↑
            červená  oranžová
            = expir  = do 90 dní
```

**Ukázka barev (Tailwind třídy):**
- Expirováno/kritické (≤30 dní): `bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`
- Brzy (31–90 dní): `bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300`
- Upozornění (91–180 dní): `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300`
- OK (>180 dní): stávající modrá `bg-blue-100 text-blue-700`
- Bez data expirace: šedá

Změny jsou čistě frontendové — pouze v `src/pages/Clients.tsx`, žádné databázové změny.
