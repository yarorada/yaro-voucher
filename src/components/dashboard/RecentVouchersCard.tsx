import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Voucher {
  id: string;
  voucher_code: string;
  client_name: string;
  hotel_name: string | null;
  sent_at: string | null;
  created_at: string;
  deals: { destinations: { name: string } | null } | null;
}

export const RecentVouchersCard = () => {
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["recent-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, voucher_code, client_name, hotel_name, sent_at, created_at, deals(destinations(name))")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Voucher[];
    },
  });

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
            {vouchers.map((voucher) => (
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
                    {voucher.client_name}
                    {voucher.deals?.destinations?.name && ` • ${voucher.deals.destinations.name}`}
                  </p>
                </div>
                {voucher.sent_at ? (
                  <Badge variant="default" className="text-xs">Odesláno</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Neodesláno</Badge>
                )}
              </Link>
            ))}
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
