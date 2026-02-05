
## Dashboard s informačními dlaždicemi

Přetvořím domovskou stránku na interaktivní dashboard s přehledovými dlaždicemi.

### Nové komponenty a funkce

#### 1. Hlavní dlaždice - Denní úkoly
- Vytvoření nové databázové tabulky `tasks` pro správu úkolů
- Zobrazení úkolů plánovaných na aktuální den
- Možnost přidávat, označovat jako splněné a mazat úkoly
- Barevné rozlišení podle priority (nízká, střední, vysoká)

#### 2. Dlaždice statistik prodeje (aktuální rok)
- Celkový obrat v aktuálním roce
- Celkový zisk
- Počet obchodních případů
- Meziroční srovnání (YoY)

#### 3. Dlaždice posledních obchodních případů
- Seznam 5 nejnovějších obchodních případů
- Zobrazení čísla, klienta, destinace a stavu
- Rychlý odkaz na detail

#### 4. Dlaždice posledních voucherů
- Seznam 5 nejnovějších voucherů
- Zobrazení kódu, klienta a hotelu
- Rychlý odkaz na detail

#### 5. Dlaždice posledních smluv
- Seznam 5 nejnovějších smluv
- Zobrazení čísla smlouvy, klienta a stavu
- Rychlý odkaz na detail

### Rozložení na stránce

```text
+------------------------------------------+
|           Logo + Vítejte v YARO          |
+------------------------------------------+
|  [Denní úkoly]    |  [Statistiky roku]   |
|  - úkol 1 ✓       |  Obrat: 2.5M Kč      |
|  - úkol 2         |  Zisk: 450K Kč       |
|  + Přidat úkol    |  Případy: 45         |
+-------------------+----------------------+
|  [Obch. případy]  | [Vouchery] |[Smlouvy]|
|  - D-25001...     | - YT-25001 | - CS-01 |
|  - D-25002...     | - YT-25002 | - CS-02 |
+-------------------+------------+---------+
```

### Technické detaily

#### Databáze - nová tabulka `tasks`
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  priority TEXT DEFAULT 'medium',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies pro tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);
```

#### Soubory k úpravě/vytvoření
1. `src/pages/Index.tsx` - kompletní přepracování na dashboard
2. `src/components/dashboard/TasksCard.tsx` - komponenta pro denní úkoly
3. `src/components/dashboard/StatsCard.tsx` - komponenta pro statistiky
4. `src/components/dashboard/RecentDealsCard.tsx` - poslední obchodní případy
5. `src/components/dashboard/RecentVouchersCard.tsx` - poslední vouchery
6. `src/components/dashboard/RecentContractsCard.tsx` - poslední smlouvy

#### Datové dotazy
- Statistiky: využití existujícího view `deal_profitability`
- Obchodní případy: `deals` s limitem 5, řazeno podle `created_at DESC`
- Vouchery: `vouchers` s limitem 5, řazeno podle `created_at DESC`
- Smlouvy: `travel_contracts` s limitem 5, řazeno podle `created_at DESC`
- Úkoly: `tasks` filtrováno podle `due_date = today`

#### Responsivní design
- Na mobilu: dlaždice pod sebou v jednom sloupci
- Na tabletu: 2 sloupce
- Na desktopu: flexibilní grid s hlavní dlaždice úkolů vlevo
