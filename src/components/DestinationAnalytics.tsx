import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin } from "lucide-react";

interface DestinationStat {
  destinationId: string;
  destinationName: string;
  countryName: string;
  countryFlag: string;
  dealCount: number;
  totalRevenue: number;
  averagePrice: number;
}

interface DestinationAnalyticsProps {
  destinationStats: DestinationStat[];
}

export function DestinationAnalytics({ destinationStats }: DestinationAnalyticsProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Analýza podle destinací</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Země</TableHead>
            <TableHead>Destinace</TableHead>
            <TableHead className="text-right">Počet dealů</TableHead>
            <TableHead className="text-right">Celkový obrat</TableHead>
            <TableHead className="text-right">Průměrná cena</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {destinationStats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Žádná data k zobrazení
              </TableCell>
            </TableRow>
          ) : (
            destinationStats.map((stat) => (
              <TableRow key={stat.destinationId}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{stat.countryFlag}</span>
                    {stat.countryName}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{stat.destinationName}</TableCell>
                <TableCell className="text-right">{stat.dealCount}</TableCell>
                <TableCell className="text-right">{stat.totalRevenue.toLocaleString('cs-CZ')} Kč</TableCell>
                <TableCell className="text-right">{stat.averagePrice.toLocaleString('cs-CZ')} Kč</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
