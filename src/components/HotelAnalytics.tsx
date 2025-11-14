import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";

interface HotelStat {
  hotelName: string;
  reservationCount: number;
  totalRevenue: number;
  averageMargin: number;
}

interface HotelAnalyticsProps {
  hotelStats: HotelStat[];
}

export function HotelAnalytics({ hotelStats }: HotelAnalyticsProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">TOP 10 hotelů</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hotel</TableHead>
            <TableHead className="text-right">Počet rezervací</TableHead>
            <TableHead className="text-right">Celkový obrat</TableHead>
            <TableHead className="text-right">Průměrná marže</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotelStats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Žádná data k zobrazení
              </TableCell>
            </TableRow>
          ) : (
            hotelStats.map((stat, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{stat.hotelName}</TableCell>
                <TableCell className="text-right">{stat.reservationCount}</TableCell>
                <TableCell className="text-right">{stat.totalRevenue.toLocaleString('cs-CZ')} Kč</TableCell>
                <TableCell className="text-right">
                  <span className={
                    stat.averageMargin >= 20 ? "text-success font-semibold" :
                    stat.averageMargin >= 10 ? "text-warning" :
                    "text-destructive"
                  }>
                    {stat.averageMargin.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
