import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { Link } from "react-router-dom";
import { Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  destinations: { name: string } | null;
  deal_travelers: Array<{
    is_lead_traveler: boolean;
    clients: { first_name: string; last_name: string } | null;
  }>;
}

export const RecentDealsCard = () => {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["recent-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          deal_number,
          status,
          created_at,
          destinations(name),
          deal_travelers(is_lead_traveler, clients(first_name, last_name))
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Deal[];
    },
  });

  const getLeadClient = (deal: Deal) => {
    const lead = deal.deal_travelers?.find((t) => t.is_lead_traveler);
    if (lead?.clients) {
      return `${lead.clients.first_name} ${lead.clients.last_name}`;
    }
    return "—";
  };

  const getBaseNumber = (dealNumber: string) => {
    // Extract base number (D-YYXXXX) from full deal_number
    const match = dealNumber.match(/^D-\d{6}/);
    return match ? match[0] : dealNumber;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5 text-primary" />
          Poslední obch. případy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : deals.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Žádné obchodní případy
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}`}
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {getBaseNumber(deal.deal_number)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getLeadClient(deal)}
                    {deal.destinations?.name && ` • ${deal.destinations.name}`}
                  </p>
                </div>
                <DealStatusBadge status={deal.status} />
              </Link>
            ))}
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link to="/deals">
                Zobrazit vše <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
