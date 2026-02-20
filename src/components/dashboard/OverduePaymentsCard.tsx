import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { formatPriceCurrency } from "@/lib/utils";
import { differenceInDays, parseISO, format } from "date-fns";

interface PaymentRow {
  id: string;
  amount: number;
  due_date: string;
  payment_type: string;
  notes: string | null;
  source: "deal" | "contract";
  source_id: string;
  label: string;
  clientName: string | null;
}

export const OverduePaymentsCard = () => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["dashboard-unpaid-payments"],
    queryFn: async () => {
      const [dealRes, contractRes] = await Promise.all([
        supabase
          .from("deal_payments")
          .select("id, amount, due_date, payment_type, notes, deal_id, deals(deal_number, deal_travelers(is_lead_traveler, clients(first_name, last_name)))")
          .eq("paid", false)
          .order("due_date", { ascending: true }),
        supabase
          .from("contract_payments")
          .select("id, amount, due_date, payment_type, notes, contract_id, travel_contracts(contract_number, clients(first_name, last_name))")
          .eq("paid", false)
          .order("due_date", { ascending: true }),
      ]);

      if (dealRes.error) throw dealRes.error;
      if (contractRes.error) throw contractRes.error;

      const rows: PaymentRow[] = [];

      for (const dp of dealRes.data || []) {
        const deal = dp.deals as any;
        const lead = deal?.deal_travelers?.find((t: any) => t.is_lead_traveler);
        const clientName = lead?.clients
          ? `${lead.clients.first_name} ${lead.clients.last_name}`
          : null;
        rows.push({
          id: dp.id,
          amount: dp.amount,
          due_date: dp.due_date,
          payment_type: dp.payment_type,
          notes: dp.notes,
          source: "deal",
          source_id: dp.deal_id,
          label: deal?.deal_number?.match(/^D-\d{6}/)?.[0] || "Deal",
          clientName,
        });
      }

      for (const cp of contractRes.data || []) {
        const contract = cp.travel_contracts as any;
        const client = contract?.clients;
        const clientName = client
          ? `${client.first_name} ${client.last_name}`
          : null;
        rows.push({
          id: cp.id,
          amount: cp.amount,
          due_date: cp.due_date,
          payment_type: cp.payment_type,
          notes: cp.notes,
          source: "contract",
          source_id: cp.contract_id,
          label: contract?.contract_number || "Smlouva",
          clientName,
        });
      }

      rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
      return rows;
    },
  });

  const overdue = payments.filter((p) => p.due_date < today);
  const upcoming = payments.filter((p) => p.due_date >= today);
  const totalOverdue = overdue.reduce((s, p) => s + p.amount, 0);

  const typeLabel = (t: string) => (t === "final" ? "Doplatek" : "Záloha");

  const typeCircle = (t: string) => {
    if (t === "final") return "D";
    // deposit_1, deposit_2, deposit etc.
    const match = t.match(/deposit_?(\d)?/);
    if (match) return match[1] ? `Z${match[1]}` : "Z";
    return "Z";
  };

  const renderRow = (p: PaymentRow) => {
    const daysOver = differenceInDays(new Date(), parseISO(p.due_date));
    const isOverdue = p.due_date < today;
    const link = p.source === "deal" ? `/deals/${p.source_id}` : `/contracts/${p.source_id}`;

    return (
      <Link
        key={`${p.source}-${p.id}`}
        to={link}
        className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border-2 border-primary text-[10px] font-bold text-primary shrink-0">
              {typeCircle(p.payment_type)}
            </span>
            <span className="font-medium text-sm">{p.label}</span>
            {p.clientName && (
              <span className="text-sm text-muted-foreground">• {p.clientName}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Splatnost: {format(parseISO(p.due_date), "d.M.yyyy")}
            {isOverdue && (
              <span className="text-destructive font-medium ml-1">
                ({daysOver} {daysOver === 1 ? "den" : daysOver < 5 ? "dny" : "dnů"} po splatnosti)
              </span>
            )}
          </p>
        </div>
        <span className={`text-sm font-bold whitespace-nowrap ${isOverdue ? "text-destructive" : ""}`}>
          {formatPriceCurrency(p.amount)}
        </span>
      </Link>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary" />
          Nezaplacené platby
          {overdue.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {overdue.length} po splatnosti
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : payments.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Žádné nezaplacené platby 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {totalOverdue > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Celkem po splatnosti: {formatPriceCurrency(totalOverdue)}
              </div>
            )}

            {overdue.length > 0 && (
              <div className="space-y-1">
                {overdue.map(renderRow)}
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="space-y-1">
                {overdue.length > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                    <Clock className="h-3 w-3" /> Nadcházející
                  </p>
                )}
                {upcoming.slice(0, 5).map(renderRow)}
                {upcoming.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    … a dalších {upcoming.length - 5} plateb
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
