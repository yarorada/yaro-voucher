import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsSummaryCardsProps {
  stats: {
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    dealCount: number;
    revenueChange: number | null;
    costsChange: number | null;
    profitChange: number | null;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
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

export const StatsSummaryCards = ({ stats }: StatsSummaryCardsProps) => {
  const margin = stats.totalRevenue > 0 
    ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(0) 
    : "0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Obrat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          <ChangeIndicator value={stats.revenueChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Náklady
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalCosts)}</div>
          <ChangeIndicator value={stats.costsChange} inverted />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Zisk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalProfit)}</div>
          <ChangeIndicator value={stats.profitChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Marže / Počet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{margin}%</div>
          <span className="text-xs text-muted-foreground">
            {stats.dealCount} obchodních případů
          </span>
        </CardContent>
      </Card>
    </div>
  );
};
