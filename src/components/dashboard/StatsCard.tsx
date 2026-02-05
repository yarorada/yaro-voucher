import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { formatPriceCurrency } from "@/lib/utils";

interface YearStats {
  revenue: number;
  costs: number;
  profit: number;
  dealCount: number;
}

const formatPercent = (value: number | null) => {
  if (value === null) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

const ChangeIndicator = ({ value, inverted = false }: { value: number | null; inverted?: boolean }) => {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  
  const isPositive = inverted ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.5;
  
  if (isNeutral) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        {formatPercent(value)} YoY
      </span>
    );
  }
  
  return (
    <span className={`flex items-center gap-1 text-xs ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatPercent(value)} YoY
    </span>
  );
};

export const StatsCard = () => {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", currentYear],
    queryFn: async () => {
      // Get current year stats
      const { data: currentData, error: currentError } = await supabase
        .from("deal_profitability")
        .select("revenue, total_costs, profit, start_date")
        .gte("start_date", `${currentYear}-01-01`)
        .lte("start_date", `${currentYear}-12-31`);

      if (currentError) throw currentError;

      // Get last year stats for comparison
      const { data: lastYearData, error: lastYearError } = await supabase
        .from("deal_profitability")
        .select("revenue, total_costs, profit, start_date")
        .gte("start_date", `${lastYear}-01-01`)
        .lte("start_date", `${lastYear}-12-31`);

      if (lastYearError) throw lastYearError;

      const currentStats: YearStats = {
        revenue: currentData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0,
        costs: currentData?.reduce((sum, d) => sum + (d.total_costs || 0), 0) || 0,
        profit: currentData?.reduce((sum, d) => sum + (d.profit || 0), 0) || 0,
        dealCount: currentData?.length || 0,
      };

      const lastYearStats: YearStats = {
        revenue: lastYearData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0,
        costs: lastYearData?.reduce((sum, d) => sum + (d.total_costs || 0), 0) || 0,
        profit: lastYearData?.reduce((sum, d) => sum + (d.profit || 0), 0) || 0,
        dealCount: lastYearData?.length || 0,
      };

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : null;
        return ((current - previous) / previous) * 100;
      };

      return {
        ...currentStats,
        revenueChange: calculateChange(currentStats.revenue, lastYearStats.revenue),
        profitChange: calculateChange(currentStats.profit, lastYearStats.profit),
        dealCountChange: calculateChange(currentStats.dealCount, lastYearStats.dealCount),
      };
    },
  });

  const margin = stats && stats.revenue > 0 
    ? ((stats.profit / stats.revenue) * 100).toFixed(1) 
    : "0";

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Statistiky {currentYear}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Obrat</p>
              <p className="text-xl font-bold">{formatPriceCurrency(stats?.revenue || 0)}</p>
              <ChangeIndicator value={stats?.revenueChange || null} />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Zisk</p>
              <p className="text-xl font-bold">{formatPriceCurrency(stats?.profit || 0)}</p>
              <ChangeIndicator value={stats?.profitChange || null} />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Marže</p>
              <p className="text-xl font-bold">{margin}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Případy</p>
              <p className="text-xl font-bold">{stats?.dealCount || 0}</p>
              <ChangeIndicator value={stats?.dealCountChange || null} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
