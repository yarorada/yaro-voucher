import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

export const RecentVouchersCard = () => {
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["recent-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select(`
          id, voucher_code, client_name, hotel_name, sent_at, created_at, services,
          deals(start_date, destinations(name, countries(iso_code))),
          voucher_travelers(is_main_client, clients(first_name, last_name))
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as any[];
    },
  });

  const getClientName = (v: any): string => {
    const mainTraveler = (v.voucher_travelers || []).find((t: any) => t.is_main_client);
    if (mainTraveler?.clients) return `${mainTraveler.clients.first_name} ${mainTraveler.clients.last_name}`;
    const firstTraveler = (v.voucher_travelers || [])[0];
    if (firstTraveler?.clients) return `${firstTraveler.clients.first_name} ${firstTraveler.clients.last_name}`;
    return v.client_name || "";
  };

  const getFirstServiceDate = (v: any): string | null => {
    const servicesArr = Array.isArray(v.services) ? v.services : [];
    return servicesArr
      .map((s: any) => s.start_date)
      .filter(Boolean)
      .sort()
      [0] || null;
  };

  const buildDescription = (v: any) => {
    const parts: string[] = [];
    const client = getClientName(v);
    if (client) parts.push(client);
    const iso = v.deals?.destinations?.countries?.iso_code;
    if (iso) parts.push(iso);
    if (v.hotel_name) parts.push(v.hotel_name);
    const date = formatDateShort(getFirstServiceDate(v));
    if (date) parts.push(date);
    return parts.join(" • ");
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
          <div className="space-y-2">
            {vouchers.map((voucher) => (
              <Link
                key={voucher.id}
                to={`/vouchers/${voucher.id}`}
                className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {voucher.sent_at ? (
                    <Badge className="text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Odesláno</Badge>
                  ) : (
                    <Badge className="text-xs shrink-0 bg-gray-500 hover:bg-gray-600 text-white border-transparent">Neodesláno</Badge>
                  )}
                  <span className="font-bold text-sm">{voucher.voucher_code}</span>
                </div>
                <div className="text-xs text-muted-foreground pl-1 truncate">
                  {[
                    getClientName(voucher),
                    voucher.deals?.destinations?.name || voucher.hotel_name,
                    formatDateShort(getFirstServiceDate(voucher)),
                  ].filter(Boolean).join(" • ")}
                </div>
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
