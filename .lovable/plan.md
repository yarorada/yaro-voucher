
# Plán: Statistiky prodejů

## Přehled
Vytvoření nové stránky Statistiky v navigaci, která bude zobrazovat přehledy prodejů (obrat a zisky) s možností filtrování podle roku, čtvrtletí a měsíce. Data budou řazena podle data odjezdu (`start_date`). Součástí budou tabulky s porovnáním období a grafy.

## Rozsah změn

### 1. Navigace
- Přidání položky "Statistiky" do postranního menu (`AppSidebar.tsx`)
- Ikona: `BarChart3` z lucide-react
- Pozice: mezi "Smlouvy" a "Klienti"

### 2. Nová stránka `/statistics`
- Soubor: `src/pages/Statistics.tsx`
- Route v `App.tsx`

### 3. Hlavní komponenty stránky

```text
+----------------------------------------------------------+
|  STATISTIKY                                              |
+----------------------------------------------------------+
|  [Rok: 2026 v]  [Období: Čtvrtletí v]  [Stav: Všechny v] |
+----------------------------------------------------------+
|                                                          |
|  +----------------+  +----------------+  +---------------+|
|  |  OBRAT         |  |  NÁKLADY       |  |  ZISK         ||
|  |  1 234 567 Kč  |  |  987 654 Kč    |  |  246 913 Kč   ||
|  |  ▲ +15% YoY    |  |  ▲ +8% YoY     |  |  ▲ +35% YoY   ||
|  +----------------+  +----------------+  +---------------+|
|                                                          |
|  +--------------------------+  +------------------------+|
|  |  GRAF: Vývoj v čase      |  |  GRAF: Podle zemí      ||
|  |  [BarChart]              |  |  [PieChart]            ||
|  +--------------------------+  +------------------------+|
|                                                          |
|  +------------------------------------------------------+|
|  |  TABULKA: Porovnání období                           ||
|  |  Období | Obrat | Náklady | Zisk | Marže | Změna     ||
|  |  Q1     | ...   | ...     | ...  | ...   | ▲ +10%    ||
|  |  Q2     | ...   | ...     | ...  | ...   | ▼ -5%     ||
|  +------------------------------------------------------+|
|                                                          |
|  +------------------------------------------------------+|
|  |  TABULKA: Prodeje podle zemí/destinací               ||
|  |  Země    | Počet | Obrat | Zisk | Podíl              ||
|  |  Thajsko | 5     | ...   | ...  | 45%                ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### 4. Funkce a filtry

**Časové filtry:**
- Rok (dropdown s roky kde existují data)
- Období: Rok / Čtvrtletí / Měsíc
- Filtr pouze potvrzené/dokončené případy

**Metriky:**
- Celkový obrat (suma `total_price` z deals)
- Celkové náklady (suma `cost_price * person_count` ze služeb)
- Celkový zisk (obrat - náklady)
- Marže (zisk / obrat * 100)

**Porovnání:**
- Meziroční změna (YoY - Year over Year)
- Mezikvartální změna

### 5. Grafy (recharts)

**Graf 1: Vývoj v čase**
- Sloupcový graf zobrazující obrat a zisk
- Osa X: čtvrtletí nebo měsíce
- Osa Y: hodnota v Kč

**Graf 2: Rozložení podle zemí**
- Koláčový graf nebo horizontální sloupcový graf
- Zobrazení podílu jednotlivých zemí na celkovém obratu

---

## Technické detaily

### Datové zdroje
- Využití view `deal_profitability` pro agregovaná data
- Query spojující `deals`, `destinations`, `countries` pro geografické členění
- Filtrování podle `start_date` (datum odjezdu)

### Příklad SQL dotazu pro statistiky
```sql
SELECT 
  EXTRACT(YEAR FROM d.start_date) as year,
  EXTRACT(QUARTER FROM d.start_date) as quarter,
  c.name as country_name,
  COUNT(*) as deal_count,
  SUM(dp.revenue) as total_revenue,
  SUM(dp.total_costs) as total_costs,
  SUM(dp.profit) as total_profit
FROM deals d
LEFT JOIN deal_profitability dp ON d.id = dp.deal_id
LEFT JOIN destinations dest ON d.destination_id = dest.id
LEFT JOIN countries c ON dest.country_id = c.id
WHERE d.start_date IS NOT NULL
GROUP BY year, quarter, country_name
```

### Nové soubory
1. `src/pages/Statistics.tsx` - hlavní stránka
2. `src/components/statistics/StatsSummaryCards.tsx` - karty s přehledem
3. `src/components/statistics/StatsTimeChart.tsx` - graf vývoje
4. `src/components/statistics/StatsCountryChart.tsx` - graf podle zemí
5. `src/components/statistics/StatsPeriodTable.tsx` - tabulka porovnání
6. `src/components/statistics/StatsCountryTable.tsx` - tabulka zemí

### Úpravy existujících souborů
1. `src/components/AppSidebar.tsx` - přidání menu položky
2. `src/App.tsx` - přidání route

---

## Pořadí implementace
1. Přidat položku "Statistiky" do navigace
2. Vytvořit základní strukturu stránky s filtry
3. Implementovat souhrnné karty (obrat, náklady, zisk)
4. Přidat tabulku porovnání období
5. Přidat tabulku podle zemí
6. Implementovat graf vývoje v čase
7. Implementovat graf podle zemí
8. Přidat výpočet meziročních změn
