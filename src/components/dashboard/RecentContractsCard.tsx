import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileSignature, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Contract {
  id: string;
  contract_number: string;
  status: "draft" | "sent" | "signed" | "cancelled";
  created_at: string;
  clients: { first_name: string; last_name: string } | null;
}

const statusConfig = {
  draft: { label: "Koncept", variant: "secondary" as const },
  sent: { label: "Odesláno", variant: "default" as const },
  signed: { label: "Podepsáno", variant: "default" as const },
  cancelled: { label: "Zrušeno", variant: "destructive" as const },
};

export const RecentContractsCard = () => {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["recent-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_contracts")
        .select(`
          id,
          contract_number,
          status,
          created_at,
          clients(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Contract[];
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSignature className="h-5 w-5 text-primary" />
          Poslední smlouvy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : contracts.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Žádné smlouvy
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                to={`/contracts/${contract.id}`}
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {contract.contract_number}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contract.clients
                      ? `${contract.clients.first_name} ${contract.clients.last_name}`
                      : "—"}
                  </p>
                </div>
                <Badge variant={statusConfig[contract.status].variant} className="text-xs">
                  {statusConfig[contract.status].label}
                </Badge>
              </Link>
            ))}
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link to="/contracts">
                Zobrazit vše <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
