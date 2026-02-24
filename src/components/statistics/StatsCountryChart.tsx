import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { StatsData } from "@/pages/Statistics";

interface StatsCountryChartProps {
  data: StatsData[];
}

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(45, 80%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(25, 75%, 55%)",
  "hsl(190, 65%, 50%)",
  "hsl(330, 55%, 60%)",
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const StatsCountryChart = ({ data }: StatsCountryChartProps) => {
  const chartData = useMemo(() => {
    // Aggregate by country
    const aggregated = new Map<string, { name: string; value: number }>();

    data.forEach((item) => {
      const countryName = item.countryName || "Neuvedeno";
      
      if (aggregated.has(countryName)) {
        const existing = aggregated.get(countryName)!;
        existing.value += item.revenue;
      } else {
        aggregated.set(countryName, { name: countryName, value: item.revenue });
      }
    });

    return Array.from(aggregated.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 countries
  }, [data]);

  const totalRevenue = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rozložení podle zemí</CardTitle>
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
        <CardTitle className="text-base">Rozložení podle zemí</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
              style={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), "Obrat"]}
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--card-foreground))"
              }}
              itemStyle={{ color: "hsl(var(--card-foreground))" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center text-sm text-muted-foreground mt-2">
          Celkem: {formatCurrency(totalRevenue)}
        </div>
      </CardContent>
    </Card>
  );
};
