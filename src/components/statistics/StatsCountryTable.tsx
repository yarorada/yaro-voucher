import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getCountryFlag } from "@/lib/countryData";
import type { StatsData } from "@/pages/Statistics";

interface StatsCountryTableProps {
  data: StatsData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const StatsCountryTable = ({ data }: StatsCountryTableProps) => {
  const tableData = useMemo(() => {
    // Aggregate by country
    const aggregated = new Map<string, { 
      name: string; 
      revenue: number; 
      profit: number;
      dealCount: number;
    }>();

    data.forEach((item) => {
      const countryName = item.countryName || "Neuvedeno";
      
      if (aggregated.has(countryName)) {
        const existing = aggregated.get(countryName)!;
        existing.revenue += item.revenue;
        existing.profit += item.profit;
        existing.dealCount += item.dealCount;
      } else {
        aggregated.set(countryName, { 
          name: countryName, 
          revenue: item.revenue, 
          profit: item.profit,
          dealCount: item.dealCount
        });
      }
    });

    const sorted = Array.from(aggregated.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((sum, item) => sum + item.revenue, 0);

    return sorted.map((item) => ({
      ...item,
      share: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
    }));
  }, [data]);

  if (tableData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prodeje podle zemí</CardTitle>
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
        <CardTitle className="text-base">Prodeje podle zemí</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="px-1.5 sm:px-2">Země</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2 hidden sm:table-cell">Počet</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Obrat</TableHead>
              <TableHead className="text-right px-1.5 sm:px-2">Zisk</TableHead>
              <TableHead className="w-[80px] sm:w-[120px] px-1.5 sm:px-2">Podíl</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium whitespace-nowrap px-1.5 sm:px-2">
                  <span className="mr-1">{getCountryFlag(row.name)}</span>
                  {row.name}
                </TableCell>
                <TableCell className="text-right px-1.5 sm:px-2 hidden sm:table-cell">{row.dealCount}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2">{formatCurrency(row.revenue)}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-1.5 sm:px-2">{formatCurrency(row.profit)}</TableCell>
                <TableCell className="px-1.5 sm:px-2">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Progress value={row.share} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 sm:w-10 text-right">
                      {row.share.toFixed(0)}%
                    </span>
                  </div>
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
