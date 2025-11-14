import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, Percent, Briefcase } from "lucide-react";

interface AnalyticsOverviewProps {
  totalRevenue: number;
  totalProfit: number;
  averageMargin: number;
  activeDeals: number;
}

export function AnalyticsOverview({
  totalRevenue,
  totalProfit,
  averageMargin,
  activeDeals,
}: AnalyticsOverviewProps) {
  const cards = [
    {
      title: "Celkový obrat",
      value: `${totalRevenue.toLocaleString('cs-CZ')} Kč`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Celkový zisk",
      value: `${totalProfit.toLocaleString('cs-CZ')} Kč`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Průměrná marže",
      value: `${averageMargin.toFixed(1)}%`,
      icon: Percent,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Aktivní dealy",
      value: activeDeals.toString(),
      icon: Briefcase,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
            <div className={`p-3 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
