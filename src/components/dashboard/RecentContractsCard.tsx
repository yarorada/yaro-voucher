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
  deals: {
    start_date: string | null;
    destinations: { name: string; countries?: { iso_code: string } | null } | null;
    deal_services: Array<{ service_type: string; service_name: string }>;
  } | null;
}

const statusConfig = {
  draft: { label: "Koncept", className: "bg-gray-500 hover:bg-gray-600 text-white border-transparent" },
  sent: { label: "Odesláno", className: "bg-blue-500 hover:bg-blue-600 text-white border-transparent" },
  signed: { label: "Podepsáno", className: "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" },
  cancelled: { label: "Zrušeno", className: "bg-destructive hover:bg-destructive/80 text-destructive-foreground border-transparent" },
};

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

export const RecentContractsCard = () => {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["recent-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_contracts")
        .select(`
          id, contract_number, status, created_at,
          clients(first_name, last_name),
          deals(start_date, destinations(name, countries(iso_code)), deal_services(service_type, service_name))
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as unknown as Contract[];
    },
  });

  const buildDescription = (c: Contract) => {
    const parts: string[] = [];
    if (c.clients) parts.push(`${c.clients.first_name} ${c.clients.last_name}`);
    const iso = c.deals?.destinations?.countries?.iso_code;
    if (iso) parts.push(iso);
    const hotel = c.deals?.deal_services?.find((s) => s.service_type === "hotel");
    if (hotel) parts.push(hotel.service_name);
    const date = formatDateShort(c.deals?.start_date || null);
    if (date) parts.push(date);
    return parts.join(" • ");
  };

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
          <div className="space-y-2">
            {contracts.map((contract) => {
              const cfg = statusConfig[contract.status];
              return (
                <Link
                  key={contract.id}
                  to={`/contracts/${contract.id}`}
                  className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`text-xs shrink-0 ${cfg.className}`}>
                      {cfg.label}
                    </Badge>
                    <span className="font-bold text-sm text-muted-foreground">{contract.contract_number}</span>
                    <span className="text-sm truncate">{buildDescription(contract)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pl-1">
                    {contract.deals?.destinations?.name && <span>{contract.deals.destinations.name}</span>}
                    {contract.deals?.start_date && (
                      <span>{formatDateShort(contract.deals.start_date)}</span>
                    )}
                  </div>
                </Link>
              );
            })}
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
