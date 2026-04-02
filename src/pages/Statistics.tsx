import { useState, useEffect, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatsSummaryCards } from "@/components/statistics/StatsSummaryCards";
import { StatsTimeChart } from "@/components/statistics/StatsTimeChart";
import { StatsCountryChart } from "@/components/statistics/StatsCountryChart";
import { StatsPeriodTable } from "@/components/statistics/StatsPeriodTable";
import { StatsCountryTable } from "@/components/statistics/StatsCountryTable";
import { StatsClientTable } from "@/components/statistics/StatsClientTable";
import { Loader2 } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";

type PeriodType = "year" | "quarter" | "month";
type StatusFilter = "all" | "confirmed" | "completed";

interface DealWithDetails {
  id: string;
  deal_number: string;
  status: string;
  start_date: string | null;
  total_price: number | null;
  destination_id: string | null;
  destinations?: {
    id: string;
    name: string;
    country_id: string;
    countries?: {
      id: string;
      name: string;
    };
  };
}

interface DealProfitability {
  deal_id: string;
  revenue: number | null;
  total_costs: number | null;
  profit: number | null;
  start_date: string | null;
  status: string | null;
}

interface FlightCostPerDeal {
  deal_id: string;
  flightRevenue: number;
  flightCost: number;
}

export interface StatsData {
  year: number;
  quarter?: number;
  month?: number;
  countryName: string | null;
  countryId: string | null;
  dealCount: number;
  revenue: number;
  costs: number;
  profit: number;
}

const Statistics = () => {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealWithDetails[]>([]);
  const [profitability, setProfitability] = useState<DealProfitability[]>([]);
  const [flightCosts, setFlightCosts] = useState<FlightCostPerDeal[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [periodType, setPeriodType] = useState<PeriodType>("quarter");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [excludeFlights, setExcludeFlights] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch deals with destination and country info — only deals with a travel contract
      const { data: dealsData, error: dealsError } = await supabase
        .from("deals")
        .select(`
          id,
          deal_number,
          status,
          start_date,
          total_price,
          destination_id,
          destinations (
            id,
            name,
            country_id,
            countries (
              id,
              name
            )
          ),
          travel_contracts!travel_contracts_deal_id_fkey (id)
        `)
        .not("start_date", "is", null)
        .not("travel_contracts", "is", null);
      
      // Keep only deals that have at least one travel contract
      const dealsWithContract = (dealsData || []).filter(
        (d: any) => Array.isArray(d.travel_contracts) && d.travel_contracts.length > 0
      );

      if (dealsError) throw dealsError;

      // Fetch profitability data
      const { data: profitData, error: profitError } = await supabase
        .from("deal_profitability")
        .select("*");

      if (profitError) throw profitError;

      // Fetch flight services for exclude-flights toggle (include currency fields for conversion)
      const { data: flightData, error: flightError } = await supabase
        .from("deal_services")
        .select("deal_id, price, cost_price, cost_price_original, price_currency, quantity, person_count, details")
        .eq("service_type", "flight");

      if (flightError) throw flightError;

      // Aggregate flight costs per deal (respecting price_mode and currency conversion)
      const flightMap = new Map<string, { revenue: number; cost: number }>();
      (flightData || []).forEach((f: any) => {
        const priceMode = f.details?.price_mode || "per_service";
        const multiplier = priceMode === "per_person" ? (f.person_count || 1) : (f.quantity || 1);
        const existing = flightMap.get(f.deal_id) || { revenue: 0, cost: 0 };
        // Convert flight revenue to CZK if in foreign currency
        let priceInCzk = f.price || 0;
        if (f.price_currency && f.price_currency !== "CZK" && f.cost_price_original > 0 && f.cost_price > 0) {
          const rate = f.cost_price / f.cost_price_original;
          priceInCzk = (f.price || 0) * rate;
        }
        existing.revenue += priceInCzk * multiplier;
        existing.cost += (f.cost_price || 0) * multiplier;
        flightMap.set(f.deal_id, existing);
      });
      const flightCostsArr: FlightCostPerDeal[] = Array.from(flightMap.entries()).map(([deal_id, v]) => ({
        deal_id,
        flightRevenue: v.revenue,
        flightCost: v.cost,
      }));

      setDeals((dealsWithContract as unknown as DealWithDetails[]) || []);
      setProfitability(profitData || []);
      setFlightCosts(flightCostsArr);

      // Extract available years
      const years = new Set<number>();
      dealsWithContract?.forEach((deal) => {
        if (deal.start_date) {
          years.add(new Date(deal.start_date).getFullYear());
        }
      });
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      setAvailableYears(sortedYears);
      
      // Set current year as default if available
      const currentYear = new Date().getFullYear();
      if (sortedYears.includes(currentYear)) {
        setSelectedYear(currentYear.toString());
      } else if (sortedYears.length > 0) {
        setSelectedYear(sortedYears[0].toString());
      }
    } catch (error) {
      console.error("Error fetching statistics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let filtered = deals.filter((deal) => {
      // Filter by status
      if (statusFilter === "confirmed" && deal.status !== "confirmed") return false;
      if (statusFilter === "completed" && deal.status !== "completed") return false;
      if (statusFilter === "all" && deal.status === "cancelled") return false;

      // Filter by year
      if (selectedYear !== "all" && deal.start_date) {
        const dealYear = new Date(deal.start_date).getFullYear();
        if (dealYear !== parseInt(selectedYear)) return false;
      }

      return true;
    });

    return filtered;
  }, [deals, selectedYear, statusFilter]);

  const statsData = useMemo((): StatsData[] => {
    const groupedData = new Map<string, StatsData>();

    filteredData.forEach((deal) => {
      if (!deal.start_date) return;

      const date = new Date(deal.start_date);
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const month = date.getMonth() + 1;
      const countryName = deal.destinations?.countries?.name || null;
      const countryId = deal.destinations?.countries?.id || null;

      // Find profitability data for this deal
      const profitData = profitability.find((p) => p.deal_id === deal.id);
      let revenue = profitData?.revenue || deal.total_price || 0;
      let costs = profitData?.total_costs || 0;

      // Subtract flight costs if toggle is on
      if (excludeFlights) {
        const fc = flightCosts.find((f) => f.deal_id === deal.id);
        if (fc) {
          revenue -= fc.flightRevenue;
          costs -= fc.flightCost;
        }
      }

      const profit = revenue - costs;

      let key: string;
      let entry: Partial<StatsData>;

      if (periodType === "year") {
        key = `${year}-${countryId || "unknown"}`;
        entry = { year, countryName, countryId };
      } else if (periodType === "quarter") {
        key = `${year}-Q${quarter}-${countryId || "unknown"}`;
        entry = { year, quarter, countryName, countryId };
      } else {
        key = `${year}-M${month}-${countryId || "unknown"}`;
        entry = { year, month, countryName, countryId };
      }

      if (groupedData.has(key)) {
        const existing = groupedData.get(key)!;
        existing.dealCount += 1;
        existing.revenue += revenue;
        existing.costs += costs;
        existing.profit += profit;
      } else {
        groupedData.set(key, {
          ...entry,
          dealCount: 1,
          revenue,
          costs,
          profit,
        } as StatsData);
      }
    });

    return Array.from(groupedData.values());
  }, [filteredData, profitability, periodType, excludeFlights, flightCosts]);

  const summaryStats = useMemo(() => {
    const totalRevenue = statsData.reduce((sum, d) => sum + d.revenue, 0);
    const totalCosts = statsData.reduce((sum, d) => sum + d.costs, 0);
    const totalProfit = statsData.reduce((sum, d) => sum + d.profit, 0);
    const dealCount = statsData.reduce((sum, d) => sum + d.dealCount, 0);

    // Calculate YoY comparison
    const prevYear = selectedYear !== "all" ? parseInt(selectedYear) - 1 : null;
    let prevYearStats = { revenue: 0, costs: 0, profit: 0 };

    if (prevYear) {
      const prevYearDeals = deals.filter((deal) => {
        if (!deal.start_date) return false;
        const dealYear = new Date(deal.start_date).getFullYear();
        if (dealYear !== prevYear) return false;
        if (statusFilter === "confirmed" && deal.status !== "confirmed") return false;
        if (statusFilter === "completed" && deal.status !== "completed") return false;
        if (statusFilter === "all" && deal.status === "cancelled") return false;
        return true;
      });

      prevYearDeals.forEach((deal) => {
        const profitData = profitability.find((p) => p.deal_id === deal.id);
        let rev = profitData?.revenue || deal.total_price || 0;
        let cost = profitData?.total_costs || 0;
        if (excludeFlights) {
          const fc = flightCosts.find((f) => f.deal_id === deal.id);
          if (fc) { rev -= fc.flightRevenue; cost -= fc.flightCost; }
        }
        prevYearStats.revenue += rev;
        prevYearStats.costs += cost;
        prevYearStats.profit += rev - cost;
      });
    }

    const revenueChange = prevYearStats.revenue > 0 
      ? ((totalRevenue - prevYearStats.revenue) / prevYearStats.revenue) * 100 
      : null;
    const costsChange = prevYearStats.costs > 0 
      ? ((totalCosts - prevYearStats.costs) / prevYearStats.costs) * 100 
      : null;
    const profitChange = prevYearStats.profit > 0 
      ? ((totalProfit - prevYearStats.profit) / prevYearStats.profit) * 100 
      : null;

    return {
      totalRevenue,
      totalCosts,
      totalProfit,
      dealCount,
      revenueChange,
      costsChange,
      profitChange,
    };
  }, [statsData, deals, profitability, selectedYear, statusFilter, excludeFlights, flightCosts]);

  const toolbarSelectClass = "w-[130px] h-8 text-xs";

  usePageToolbar(
    <>
      <Select value={selectedYear} onValueChange={setSelectedYear}>
        <SelectTrigger className={toolbarSelectClass}>
          <SelectValue placeholder="Rok" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny roky</SelectItem>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
        <SelectTrigger className={toolbarSelectClass}>
          <SelectValue placeholder="Období" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="year">Roky</SelectItem>
          <SelectItem value="quarter">Čtvrtletí</SelectItem>
          <SelectItem value="month">Měsíce</SelectItem>
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Stav" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechny (bez zruš.)</SelectItem>
          <SelectItem value="confirmed">Potvrzené</SelectItem>
          <SelectItem value="completed">Dokončené</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 border rounded-md px-3 py-1 h-8 bg-primary/10 border-primary/20">
        <Switch
          id="exclude-flights"
          checked={excludeFlights}
          onCheckedChange={setExcludeFlights}
          className="scale-75"
        />
        <Label htmlFor="exclude-flights" className="text-xs cursor-pointer whitespace-nowrap text-primary">
          Bez letenek
        </Label>
      </div>
    </>,
    [selectedYear, periodType, statusFilter, excludeFlights, availableYears]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <StatsSummaryCards stats={summaryStats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatsTimeChart data={statsData} periodType={periodType} />
        <StatsCountryChart data={statsData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatsPeriodTable data={statsData} periodType={periodType} />
        <StatsCountryTable data={statsData} />
      </div>

      <StatsClientTable excludeFlights={excludeFlights} flightCosts={flightCosts} />
    </div>
  );
};

export default Statistics;
