import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { StatsData } from "@/pages/Statistics";

interface StatsCountryChartProps {
  data: StatsData[];
}

// Country → national-ish color mapping
const COUNTRY_COLORS: Record<string, string> = {
  "Španělsko": "hsl(0, 75%, 45%)",        // red
  "Portugalsko": "hsl(145, 60%, 35%)",     // green
  "Turecko": "hsl(0, 70%, 50%)",           // red
  "Řecko": "hsl(210, 70%, 50%)",           // blue
  "Itálie": "hsl(140, 55%, 40%)",          // green
  "Francie": "hsl(225, 65%, 50%)",         // blue
  "Chorvatsko": "hsl(0, 60%, 50%)",        // red-checkered
  "Německo": "hsl(45, 90%, 50%)",          // gold
  "Rakousko": "hsl(0, 65%, 50%)",          // red
  "Česko": "hsl(210, 60%, 45%)",           // blue
  "Slovensko": "hsl(220, 55%, 50%)",       // blue
  "Maďarsko": "hsl(140, 50%, 38%)",        // green
  "Polsko": "hsl(0, 60%, 55%)",            // red
  "Spojené království": "hsl(225, 55%, 45%)", // navy
  "Irsko": "hsl(145, 65%, 38%)",           // green
  "Bulharsko": "hsl(140, 50%, 42%)",       // green
  "Egypt": "hsl(45, 85%, 48%)",            // gold
  "Maroko": "hsl(0, 70%, 42%)",            // red
  "Tunisko": "hsl(0, 65%, 48%)",           // red
  "Spojené arabské emiráty": "hsl(140, 55%, 35%)", // green
  "Thajsko": "hsl(225, 60%, 45%)",         // blue
  "Mexiko": "hsl(145, 55%, 35%)",          // green
  "Dominikánská republika": "hsl(220, 60%, 45%)", // blue
  "Kypr": "hsl(30, 70%, 50%)",             // orange/copper
  "Malta": "hsl(0, 60%, 50%)",             // red
  "Černá Hora": "hsl(45, 80%, 48%)",       // gold
  "Kanárské ostrovy": "hsl(45, 85%, 50%)", // yellow
  "Neuvedeno": "hsl(0, 0%, 55%)",          // gray
};

const FALLBACK_COLORS = [
  "hsl(280, 55%, 55%)",   // purple
  "hsl(25, 75%, 55%)",    // orange
  "hsl(190, 60%, 45%)",   // teal
  "hsl(330, 55%, 55%)",   // pink
  "hsl(60, 65%, 45%)",    // olive
  "hsl(200, 50%, 55%)",   // steel blue
  "hsl(15, 70%, 50%)",    // rust
  "hsl(260, 45%, 55%)",   // lavender
];

const getCountryColor = (name: string, index: number) => {
  return COUNTRY_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

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
              label={({ name, percent, x, y }) => (
                <text x={x} y={y} fill="hsl(var(--foreground))" fontSize={12} textAnchor="middle" dominantBaseline="central">
                  {`${name} (${(percent * 100).toFixed(0)}%)`}
                </text>
              )}
              labelLine={false}
            >
              {chartData.map((item, index) => (
                <Cell key={`cell-${index}`} fill={getCountryColor(item.name, index)} />
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
