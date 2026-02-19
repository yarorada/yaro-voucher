import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { Link } from "react-router-dom";
import { Briefcase, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortMode = "updated_at" | "departure_asc" | "return_asc";

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
  destinations: { name: string } | null;
  deal_travelers: Array<{
    is_lead_traveler: boolean;
    clients: { first_name: string; last_name: string } | null;
  }>;
}

export const RecentDealsCard = () => {
  const [sortBy, setSortBy] = useState<SortMode>("updated_at");

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["recent-deals", sortBy],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          id,
          deal_number,
          status,
          created_at,
          updated_at,
          start_date,
          end_date,
          destinations(name),
          deal_travelers(is_lead_traveler, clients(first_name, last_name))
        `);

      switch (sortBy) {
        case "departure_asc":
          query = query.order("start_date", { ascending: true, nullsFirst: false });
          break;
        case "return_asc":
          query = query.order("end_date", { ascending: true, nullsFirst: false });
          break;
        case "updated_at":
        default:
          query = query.order("updated_at", { ascending: false });
          break;
      }

      const { data, error } = await query.limit(10);
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
    const match = dealNumber.match(/^D-\d{6}/);
    return match ? match[0] : dealNumber;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            Obchodní případy
          </CardTitle>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMode)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Poslední změna</SelectItem>
              <SelectItem value="departure_asc">Nejbližší odjezd</SelectItem>
              <SelectItem value="return_asc">Datum návratu</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                  {(deal.start_date || deal.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {deal.start_date && formatDate(deal.start_date)}
                      {deal.start_date && deal.end_date && " → "}
                      {deal.end_date && formatDate(deal.end_date)}
                    </p>
                  )}
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