import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellRing, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface BankNotification {
  id: string;
  created_at: string;
  parsed_amount: number | null;
  parsed_vs: string | null;
  parsed_date: string | null;
  matched_payment_id: string | null;
  matched_contract_id: string | null;
  status: string;
  notes: string | null;
}

export const BankNotificationsCard = () => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["bank-notifications-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_notifications")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as BankNotification[];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (notification: BankNotification) => {
      if (!notification.matched_payment_id) {
        throw new Error("Žádná spárovaná platba");
      }

      // Call confirm-payment-match to mark payment as paid + propagate to deal
      const { data, error } = await supabase.functions.invoke("confirm-payment-match", {
        body: {
          payment_id: notification.matched_payment_id,
          paid_at: notification.parsed_date
            ? new Date(notification.parsed_date).toISOString()
            : new Date().toISOString(),
          table: "contract_payments",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error("Potvrzení selhalo");

      // Mark notification as confirmed
      const { error: updateErr } = await supabase
        .from("bank_notifications")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() } as any)
        .eq("id", notification.id);
      if (updateErr) throw updateErr;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-notifications-pending"] });
      queryClient.invalidateQueries({ queryKey: ["contract-payments"] });
      queryClient.invalidateQueries({ queryKey: ["deal-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
      const msg = data.deal_propagated
        ? "Platba potvrzena a propsána do OP"
        : "Platba potvrzena";
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba při potvrzování");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_notifications")
        .update({ status: "dismissed" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-notifications-pending"] });
      toast.success("Notifikace zamítnuta");
    },
  });

  const formatAmount = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount) + " Kč";
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  };

  if (notifications.length === 0 && !isLoading) return null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5 text-amber-500" />
          Příchozí platby
          {notifications.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {notifications.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Načítání...</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-lg border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">
                    {formatAmount(n.parsed_amount)}
                  </span>
                  {n.parsed_date && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(n.parsed_date)}
                    </span>
                  )}
                </div>
                {n.parsed_vs && (
                  <p className="text-xs text-muted-foreground">VS: {n.parsed_vs}</p>
                )}
                {n.notes && (
                  <p className="text-xs text-muted-foreground truncate">{n.notes}</p>
                )}
                {n.matched_payment_id ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      Shoda nalezena
                    </Badge>
                    <div className="flex gap-1 ml-auto">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => confirmMutation.mutate(n)}
                        disabled={confirmMutation.isPending}
                      >
                        {confirmMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Potvrdit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => dismissMutation.mutate(n.id)}
                        disabled={dismissMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      Bez shody
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs ml-auto"
                      onClick={() => dismissMutation.mutate(n.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
