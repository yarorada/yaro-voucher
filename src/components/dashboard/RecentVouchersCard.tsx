import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const RecentVouchersCard = () => {
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["recent-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select(`
          id, voucher_code, client_name, hotel_name, sent_at, created_at,
          deals(destinations(name)),
          voucher_travelers(is_main_client, clients(first_name, last_name))
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as any[];
    },
  });

  const getClientName = (v: any): string => {
    // Try main traveler from voucher_travelers first
    const mainTraveler = (v.voucher_travelers || []).find((t: any) => t.is_main_client);
    if (mainTraveler?.clients) {
      return `${mainTraveler.clients.first_name} ${mainTraveler.clients.last_name}`;
    }
    // Fallback to first traveler
    const firstTraveler = (v.voucher_travelers || [])[0];
    if (firstTraveler?.clients) {
      return `${firstTraveler.clients.first_name} ${firstTraveler.clients.last_name}`;
    }
    // Fallback to client_name field
    return v.client_name || "";
  };

  const getDestination = (v: any): string => {
    return v.deals?.destinations?.name || v.hotel_name || "";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Poslední vouchery
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : vouchers.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Žádné vouchery
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((voucher) => {
              const clientName = getClientName(voucher);
              const destination = getDestination(voucher);
              return (
                <Link
                  key={voucher.id}
                  to={`/vouchers/${voucher.id}`}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {voucher.voucher_code}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {clientName}
                      {destination && ` • ${destination}`}
                    </p>
                  </div>
                  {voucher.sent_at ? (
                    <Badge variant="default" className="text-xs">Odesláno</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Neodesláno</Badge>
                  )}
                </Link>
              );
            })}
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <Link to="/vouchers">
                Zobrazit vše <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
