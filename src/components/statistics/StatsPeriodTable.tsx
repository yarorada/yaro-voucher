import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StatsData } from "@/pages/Statistics";

interface StatsPeriodTableProps {
  data: StatsData[];
  periodType: "year" | "quarter" | "month";
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const monthNames = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"
];

export const StatsPeriodTable = ({ data, periodType }: StatsPeriodTableProps) => {
  const tableData = useMemo(() => {
    // Aggregate by period
    const aggregated = new Map<string, { 
      label: string; 
      revenue: number; 
      costs: number; 
      profit: number;
      dealCount: number;
      sortKey: number;
    }>();

    data.forEach((item) => {
      let key: string;
      let label: string;
      let sortKey: number;

      if (periodType === "year") {
        key = `${item.year}`;
        label = `${item.year}`;
        sortKey = item.year;
      } else if (periodType === "quarter") {
        key = `${item.year}-Q${item.quarter}`;
        label = `Q${item.quarter} ${item.year}`;
        sortKey = item.year * 10 + (item.quarter || 0);
      } else {
        key = `${item.year}-M${item.month}`;
        label = `${monthNames[(item.month || 1) - 1]} ${item.year}`;
        sortKey = item.year * 100 + (item.month || 0);
      }

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.revenue += item.revenue;
        existing.costs += item.costs;
        existing.profit += item.profit;
        existing.dealCount += item.dealCount;
      } else {
        aggregated.set(key, { 
          label, 
          revenue: item.revenue, 
          costs: item.costs, 
          profit: item.profit,
          dealCount: item.dealCount,
          sortKey 
        });
      }
    });

    const sorted = Array.from(aggregated.values()).sort((a, b) => a.sortKey - b.sortKey);
    
    // Calculate changes
    return sorted.map((item, index) => {
      const prevItem = index > 0 ? sorted[index - 1] : null;
      const change = prevItem && prevItem.profit > 0
        ? ((item.profit - prevItem.profit) / prevItem.profit) * 100
        : null;

      const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;

      return { ...item, change, margin };
    });
  }, [data, periodType]);

  if (tableData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Porovnání období</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          Žádná data k zobrazení
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Porovnání období</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="px-1.5 sm:px-2">Období</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Obrat</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2 hidden sm:table-cell">Náklady</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Zisk</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Marže</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Změna</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium whitespace-nowrap px-1.5 sm:px-2">{row.label}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2">{formatCurrency(row.revenue)}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2 hidden sm:table-cell">{formatCurrency(row.costs)}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2">{formatCurrency(row.profit)}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2">{row.margin.toFixed(0)}%</TableCell>
                <TableCell className="text-right px-1.5 sm:px-2">
                  {row.change === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={`flex items-center justify-end gap-1 ${
                      row.change > 0.5 ? "text-green-600 dark:text-green-400" : 
                      row.change < -0.5 ? "text-red-600 dark:text-red-400" : 
                      "text-muted-foreground"
                    }`}>
                      {row.change > 0.5 ? <TrendingUp className="h-3 w-3" /> : 
                       row.change < -0.5 ? <TrendingDown className="h-3 w-3" /> : 
                       <Minus className="h-3 w-3" />}
                      {row.change >= 0 ? "+" : ""}{row.change.toFixed(0)}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
};
