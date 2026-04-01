

## Zamknutí zálohových položek při modrém/červeném zvýraznění

### Kontext
Na kartě Účetnictví se hodnoty Prodej zálohy, Nákup zálohy a Zisk zálohy počítají dynamicky z deal_profitability. Když smlouva získá modré (první zaplacená splátka v minulém měsíci) nebo červené (konec zájezdu v minulém měsíci) zvýraznění, tyto hodnoty se mají "zamknout" — uložit snapshot do databáze a nadále zobrazovat uloženou hodnotu místo dynamicky vypočtené.

### Plán

**1. Migrace databáze — nové sloupce na `travel_contracts`**
- `accounting_sell_deposit_locked` (numeric, nullable)
- `accounting_buy_deposit_locked` (numeric, nullable)
- `accounting_profit_deposit_locked` (numeric, nullable)
- `accounting_deposit_locked_at` (timestamptz, nullable) — kdy bylo zamčeno

Pokud jsou tyto sloupce vyplněné, znamená to, že zálohy jsou zamčeny.

**2. Logika zamykání v `Accounting.tsx`**
- Při načtení dat z DB, pokud řádek má `highlightBlue` nebo `highlightRed` a zároveň nemá vyplněné locked sloupce → automaticky uložit aktuální vypočtené hodnoty (sellDeposit, buyDeposit, profitDeposit) do travel_contracts
- Toto se provede jednou (mutation po načtení dat) pro všechny řádky, které ještě nebyly zamčeny
- Pořadí: modrá se aplikuje jako první (dříve než červená), ale obě zamykají stejné hodnoty — stačí zamknout při prvním výskytu

**3. Zobrazení zamčených hodnot**
- Ve sloupci Prodej zál., Nákup zál., Zisk zál.: pokud existují locked hodnoty, zobrazit je místo dynamicky vypočtených
- Přidat vizuální indikátor (ikona zámku nebo tooltip) u zamčených řádků
- Zamčené hodnoty nelze editovat (jsou read-only, na rozdíl od Nákup vyúčt.)

**4. Úprava selectu v queryFn**
- Přidat `accounting_sell_deposit_locked, accounting_buy_deposit_locked, accounting_profit_deposit_locked` do select dotazu na travel_contracts
- V mapování řádků: pokud locked hodnoty existují, použít je; jinak použít dynamické

### Technické detaily

- Migrace přidá 4 nullable sloupce na `travel_contracts`
- `useEffect` v Accounting.tsx detekuje řádky s highlight + bez locked hodnot a batch-updatene je
- Zálohy se zamykají jednou a navždy — pozdější změny v dealu se do záloh nepromítnou
- Zisk zálohy se zamyká jako samostatná hodnota (ne jako computed z sell-buy), aby byl přesný snapshot

