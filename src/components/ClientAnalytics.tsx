import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClientStat {
  clientId: string;
  clientName: string;
  totalSpent: number;
  dealCount: number;
  averageMargin: number;
}

interface ClientAnalyticsProps {
  clientStats: ClientStat[];
}

export function ClientAnalytics({ clientStats }: ClientAnalyticsProps) {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">TOP 10 klientů</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klient</TableHead>
            <TableHead className="text-right">Celkem utratil</TableHead>
            <TableHead className="text-right">Počet dealů</TableHead>
            <TableHead className="text-right">Průměrná marže</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientStats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Žádná data k zobrazení
              </TableCell>
            </TableRow>
          ) : (
            clientStats.map((stat) => (
              <TableRow 
                key={stat.clientId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/clients`)}
              >
                <TableCell className="font-medium">{stat.clientName}</TableCell>
                <TableCell className="text-right">{stat.totalSpent.toLocaleString('cs-CZ')} Kč</TableCell>
                <TableCell className="text-right">{stat.dealCount}</TableCell>
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
