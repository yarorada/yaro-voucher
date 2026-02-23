import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatsData } from "@/pages/Statistics";

interface StatsTimeChartProps {
  data: StatsData[];
  periodType: "year" | "quarter" | "month";
}

const formatCurrency = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toFixed(0)}M`;
  }
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

const monthNames = [
  "Led", "Úno", "Bře", "Dub", "Kvě", "Čer",
  "Čec", "Srp", "Zář", "Říj", "Lis", "Pro"
];

export const StatsTimeChart = ({ data, periodType }: StatsTimeChartProps) => {
  const chartData = useMemo(() => {
    // Aggregate data by period (ignoring country)
    const aggregated = new Map<string, { label: string; revenue: number; profit: number; sortKey: number }>();

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
        existing.profit += item.profit;
      } else {
        aggregated.set(key, { label, revenue: item.revenue, profit: item.profit, sortKey });
      }
    });

    return Array.from(aggregated.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ label, revenue, profit }) => ({ name: label, Obrat: revenue, Zisk: profit }));
  }, [data, periodType]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vývoj v čase</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Žádná data k zobrazení
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vývoj v čase</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }} 
              className="text-muted-foreground"
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip 
              formatter={(value: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(value)}
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)"
              }}
            />
            <Legend />
            <Bar dataKey="Obrat" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Zisk" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
