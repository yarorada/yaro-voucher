import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface ServicePriceCalculatorProps {
  sellingPrice: number;
  costPrice: number;
  personCount?: number;
}

export function ServicePriceCalculator({ 
  sellingPrice, 
  costPrice, 
  personCount = 1 
}: ServicePriceCalculatorProps) {
  const totalSelling = sellingPrice * personCount;
  const totalCost = costPrice * personCount;
  const profit = totalSelling - totalCost;
  const margin = totalSelling > 0 ? (profit / totalSelling) * 100 : 0;

  const isProfit = profit >= 0;
  const marginColor = margin >= 20 ? "text-success" : margin >= 10 ? "text-warning" : "text-destructive";

  return (
    <Card className="p-4 bg-muted/50">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Prodejní cena:</span>
          <span className="font-medium">{totalSelling.toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Nákupní cena:</span>
          <span className="font-medium">{totalCost.toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold flex items-center gap-1">
            {isProfit ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            Zisk:
          </span>
          <span className={`font-semibold ${isProfit ? "text-success" : "text-destructive"}`}>
            {profit.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Marže:</span>
          <span className={`font-semibold ${marginColor}`}>
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </Card>
  );
}
