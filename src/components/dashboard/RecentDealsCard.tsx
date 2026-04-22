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

type SortMode = "departure_asc" | "departure_desc" | "return_asc" | "updated_at";

interface Deal {
  id: string;
  deal_number: string;
  status: "inquiry" | "quote" | "approved" | "confirmed" | "completed" | "cancelled" | "dispatched";
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
  destinations: { name: string; countries?: { iso_code: string } | null } | null;
  deal_travelers: Array<{
    is_lead_traveler: boolean;
    clients: { first_name: string; last_name: string } | null;
  }>;
  deal_services: Array<{
    service_type: string;
    service_name: string;
    start_date: string | null;
    end_date: string | null;
  }>;
}

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

export const RecentDealsCard = () => {
  const [sortBy, setSortBy] = useState<SortMode>("departure_asc");

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["recent-deals", sortBy],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("deals")
        .select(`
          id, deal_number, status, created_at, updated_at, start_date, end_date,
          destinations(name, countries(iso_code)),
          deal_travelers(is_lead_traveler, clients(first_name, last_name)),
          deal_services(service_type, service_name, start_date, end_date)
        `)
        .or(`start_date.gte.${today},start_date.is.null`);

      switch (sortBy) {
        case "departure_asc":
          query = query.order("start_date", { ascending: true, nullsFirst: false });
          break;
        case "departure_desc":
          query = query.order("start_date", { ascending: false, nullsFirst: false });
          break;
        case "return_asc":
          query = query.order("end_date", { ascending: true, nullsFirst: false });
          break;
        default:
          query = query.order("updated_at", { ascending: false });
          break;
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;

      // Client-side: for departure_asc, push nulls to end (future first)
      if (sortBy === "departure_asc") {
        (data as any[])?.sort((a: any, b: any) => {
          const da = a.start_date || "";
          const db = b.start_date || "";
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da < db ? -1 : da > db ? 1 : 0;
        });
      }

      return data as unknown as Deal[];
    },
  });

  const getLeadClient = (deal: Deal) => {
    const lead = deal.deal_travelers?.find((t) => t.is_lead_traveler);
    if (lead?.clients) return `${lead.clients.first_name} ${lead.clients.last_name}`;
    const first = deal.deal_travelers?.[0];
    if (first?.clients) return `${first.clients.first_name} ${first.clients.last_name}`;
    return "";
  };

  const getBaseNumber = (dealNumber: string) => {
    const match = dealNumber.match(/^D-\d{3,6}/);
    return match ? match[0] : dealNumber;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Briefcase className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Obchodní případy</span>
          </CardTitle>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMode)}>
            <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Poslední změna</SelectItem>
              <SelectItem value="departure_asc">Odjezd ↑ (nejbližší)</SelectItem>
              <SelectItem value="departure_desc">Odjezd ↓ (nejpozdější)</SelectItem>
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
          <div className="space-y-2">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}`}
                className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <DealStatusBadge status={deal.status} />
                  <span className="font-bold text-sm">{getBaseNumber(deal.deal_number)}</span>
                </div>
                <div className="text-xs text-muted-foreground pl-1 break-words">
                  {(() => {
                    const parts: string[] = [];
                    const client = getLeadClient(deal);
                    if (client) parts.push(client);
                    if (deal.destinations?.name) parts.push(deal.destinations.name);
                    const svcDates = (deal.deal_services || []).flatMap(s => [s.start_date, s.end_date]).filter(Boolean).sort() as string[];
                    const firstDate = svcDates[0];
                    const lastDate = svcDates[svcDates.length - 1];
                    if (firstDate && lastDate && firstDate !== lastDate) {
                      parts.push(`${formatDateShort(firstDate)} – ${formatDateShort(lastDate)}`);
                    } else if (firstDate) {
                      parts.push(formatDateShort(firstDate));
                    }
                    return parts.join(" • ");
                  })()}
                </div>
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
