import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DealProfitabilityPanelProps {
  totalPrice: number;
  totalCosts: number;
  discountAmount?: number;
  adjustmentAmount?: number;
}

export function DealProfitabilityPanel({
  totalPrice,
  totalCosts,
  discountAmount = 0,
  adjustmentAmount = 0,
}: DealProfitabilityPanelProps) {
  const finalRevenue = totalPrice - discountAmount + adjustmentAmount;
  const profit = finalRevenue - totalCosts;
  const margin = finalRevenue > 0 ? (profit / finalRevenue) * 100 : 0;

  const isProfit = profit >= 0;
  const marginColor = margin >= 20 ? "text-success" : margin >= 10 ? "text-warning" : "text-destructive";

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Kalkulace obchodního případu</h3>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Celková prodejní cena:</span>
          <span className="font-medium">{totalPrice.toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Celkové náklady:</span>
          <span className="font-medium">{totalCosts.toLocaleString('cs-CZ')} Kč</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-destructive">
            <span className="text-sm">Sleva:</span>
            <span className="font-medium">-{discountAmount.toLocaleString('cs-CZ')} Kč</span>
          </div>
        )}
        {adjustmentAmount !== 0 && (
          <div className={`flex justify-between items-center ${adjustmentAmount > 0 ? 'text-success' : 'text-destructive'}`}>
            <span className="text-sm">Korekce:</span>
            <span className="font-medium">
              {adjustmentAmount > 0 ? '+' : ''}{adjustmentAmount.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        )}
        
        <div className="h-px bg-border my-3" />
        
        <div className="flex justify-between items-center pt-2">
          <span className="text-base font-semibold">ZISK:</span>
          <span className={`text-xl font-bold ${isProfit ? "text-success" : "text-destructive"}`}>
            {profit.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold">Marže:</span>
          <span className={`text-xl font-bold ${marginColor}`}>
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </Card>
  );
}
