import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BellRing, Check, X, Loader2, Settings, Copy, CheckCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_URL = "https://jwaskoeqryjdjrdwupoi.supabase.co/functions/v1/bank-webhook";

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
  const [setupOpen, setSetupOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const monetaMutation = useMutation({
    mutationFn: async (daysBack: number = 7) => {
      const response = await supabase.functions.invoke("moneta-fetch-transactions", {
        body: { daysBack },
      });
      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || "Chyba při importu");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-notifications-pending"] });
      const msg = data.inserted > 0
        ? `Načteno ${data.inserted} nových plateb z Monety`
        : "Žádné nové platby k načtení";
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba při načítání z Monety");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (notification: BankNotification) => {
      if (!notification.matched_payment_id) {
        throw new Error("Žádná spárovaná platba");
      }

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

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-amber-500" />
            Příchozí platby
            {notifications.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {notifications.length}
              </Badge>
            )}
            <div className="flex gap-1 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 px-2"
                onClick={() => monetaMutation.mutate(7)}
                disabled={monetaMutation.isPending}
                title="Načíst platby z Monety za posledních 7 dní"
              >
                {monetaMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Moneta
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSetupOpen(true)}
                title="Nastavení webhooku"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Načítání...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">Žádné čekající platby</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => monetaMutation.mutate(7)}
                  disabled={monetaMutation.isPending}
                >
                  {monetaMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Načíst z Monety
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setSetupOpen(true)}>
                  <Settings className="h-3.5 w-3.5" />
                  Nastavit webhook
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{formatAmount(n.parsed_amount)}</span>
                    {n.parsed_date && (
                      <span className="text-xs text-muted-foreground">{formatDate(n.parsed_date)}</span>
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
                      <Badge variant="outline" className="text-xs border-green-500/50 text-green-700 dark:text-green-400">
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
                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-400">
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

      {/* Webhook setup dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Nastavení bankovního webhooku
            </DialogTitle>
            <DialogDescription>
              Nakonfigurujte váš bankovní systém tak, aby posílal notifikace o příchozích platbách na tuto URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Webhook URL:</p>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-xs break-all">
                <span className="flex-1">{WEBHOOK_URL}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleCopy(WEBHOOK_URL)}
                >
                  {copied ? <CheckCheck className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div>
              <p className="font-semibold mb-1">Autentizace:</p>
              <p className="text-muted-foreground">
                Přidejte do URL parametr{" "}
                <code className="bg-muted px-1 rounded">?token=VÁŠ_TOKEN</code>{" "}
                nebo hlavičku <code className="bg-muted px-1 rounded">x-webhook-secret</code>.
              </p>
              <p className="text-muted-foreground mt-1">
                Hodnotu tokenu najdete v Cloud secrets pod klíčem{" "}
                <code className="bg-muted px-1 rounded">BANK_WEBHOOK_SECRET</code>.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">Formát dat (JSON body):</p>
              <div className="space-y-2">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Strukturovaná data (JSON):</p>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{`{\n  "amount": 29000,\n  "variable_symbol": "26001",\n  "date": "2026-02-28",\n  "sender_name": "Jan Novák"\n}`}</pre>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Raw text emailu z banky:</p>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{`{\n  "emailText": "Připsána platba 29000 Kč VS 26001..."\n}`}</pre>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-amber-800 dark:text-amber-300 text-xs">
              <strong>Moneta API:</strong> Tlačítko "Moneta" v záhlaví karty načte transakce za posledních 7 dní přímo z Moneta Internet Banky. Token a číslo účtu jsou nastaveny jako secrets.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
