import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface WalletTransaction {
  id: string;
  client_id: string;
  deal_id: string | null;
  points: number;
  kind: "earn" | "redeem" | "reverse_earn" | "reverse_redeem" | "adjust";
  notes: string | null;
  created_at: string;
  deal?: { id: string; deal_number: string | null } | null;
}

const KIND_LABEL: Record<WalletTransaction["kind"], string> = {
  earn: "Připsání (zájezd)",
  redeem: "Uplatnění (sleva)",
  reverse_earn: "Storno připsání",
  reverse_redeem: "Vrácení uplatnění",
  adjust: "Úprava",
};

// Rozliš automatický přepočet (z backfill migrace), narozeninový bonus
// a expiraci bonusu od běžných zápisů.
const resolveKindLabel = (tx: WalletTransaction) => {
  if (tx.kind === "adjust" && tx.notes?.startsWith("Přepočet")) return "Auto přepočet";
  if (tx.kind === "earn" && tx.notes?.startsWith("Narozeninový bonus")) return "🎂 Narozeniny";
  if (tx.kind === "reverse_earn" && tx.notes?.startsWith("Expirace Narozeninový bonus")) return "Expirace narozenin";
  return KIND_LABEL[tx.kind];
};

// Z dlouhého deal_number (např. "D-260006 Jiří Filip NCY Korineum Golf...")
// vyextrahuj krátký identifikátor (před první mezerou).
const shortDealNumber = (s: string | null | undefined) => {
  if (!s) return "OP";
  const first = s.split(/\s/)[0];
  return first || s;
};

const KIND_COLOR: Record<WalletTransaction["kind"], string> = {
  earn: "text-green-700 dark:text-green-400",
  redeem: "text-amber-700 dark:text-amber-400",
  reverse_earn: "text-red-700 dark:text-red-400",
  reverse_redeem: "text-blue-700 dark:text-blue-400",
  adjust: "text-muted-foreground",
};

interface Props {
  clientId: string;
}

export function ClientWalletSection({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<string>("");
  const [adjustNotes, setAdjustNotes] = useState<string>("");

  const { data: balance = 0 } = useQuery({
    queryKey: ["wallet-balance", clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_wallet_balances")
        .select("balance")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data?.balance as number) || 0;
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["wallet-transactions", clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_wallet_transactions")
        .select("id, client_id, deal_id, points, kind, notes, created_at, deal:deals(id, deal_number)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as WalletTransaction[];
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const points = parseInt(adjustPoints, 10);
      if (!points || isNaN(points)) {
        throw new Error("Zadejte platný počet bodů (kladné přičte, záporné odečte)");
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("client_wallet_transactions")
        .insert({
          client_id: clientId,
          points,
          kind: "adjust",
          notes: adjustNotes.trim() || null,
          created_by: userData.user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-balance", clientId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions", clientId] });
      setAdjustOpen(false);
      setAdjustPoints("");
      setAdjustNotes("");
      toast.success("Úprava peněženky uložena");
    },
    onError: (err: any) => toast.error(err.message || "Chyba při úpravě"),
  });

  const formatDate = (s: string) => {
    const d = new Date(s);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const formatPoints = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("cs-CZ")}`;

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Peněženka
        </h4>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdjustOpen(true)}>
          <Plus className="h-3 w-3" />
          Ruční úprava
        </Button>
      </div>

      <div className="p-3 rounded-lg bg-muted/40 border">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-semibold leading-none">{balance.toLocaleString("cs-CZ")}</span>
          <span className="text-sm text-muted-foreground">bodů</span>
          <Badge variant="outline" className="text-[10px] sm:ml-auto">
            1 bod = 1 Kč slevy
          </Badge>
        </div>
        <ul className="text-xs text-muted-foreground mt-2 space-y-0.5 leading-snug list-disc list-inside marker:text-muted-foreground/50">
          <li>Načítání: 100&nbsp;Kč obratu bez letenek = 1&nbsp;bod (po ukončení zájezdu).</li>
          <li>Narozeninový bonus: 1&nbsp;500&nbsp;bodů ročně (platnost 1&nbsp;rok).</li>
          <li>Uplatnění: max.&nbsp;20&nbsp;% z ceny nového zájezdu.</li>
        </ul>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Historie transakcí</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Žádné transakce</p>
        ) : (
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-1.5 px-2 rounded hover:bg-muted/40">
                {/* Desktop (sm+): jednořádkový grid — datum | typ+OP | poznámka | body */}
                <div className="hidden sm:grid sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto] sm:gap-3 sm:items-baseline text-xs">
                  <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`${KIND_COLOR[tx.kind]} font-medium truncate`}>
                      {resolveKindLabel(tx)}
                    </span>
                    {tx.deal && (
                      <Link
                        to={`/deals/${tx.deal.id}`}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline shrink-0 tabular-nums"
                        title={tx.deal.deal_number || ""}
                      >
                        {shortDealNumber(tx.deal.deal_number)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </span>
                  <span className="text-muted-foreground truncate" title={tx.notes || ""}>
                    {tx.notes || ""}
                  </span>
                  <span
                    className={`font-semibold tabular-nums text-right whitespace-nowrap ${
                      tx.points > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {formatPoints(tx.points)}
                  </span>
                </div>

                {/* Mobile (pod sm): dvouřádkový layout */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    <span className={`${KIND_COLOR[tx.kind]} font-medium truncate`}>
                      {resolveKindLabel(tx)}
                    </span>
                    {tx.deal && (
                      <Link
                        to={`/deals/${tx.deal.id}`}
                        className="inline-flex items-center gap-0.5 text-primary hover:underline shrink-0 tabular-nums"
                        title={tx.deal.deal_number || ""}
                      >
                        {shortDealNumber(tx.deal.deal_number)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                    <span
                      className={`ml-auto font-semibold tabular-nums shrink-0 ${
                        tx.points > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {formatPoints(tx.points)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 min-w-0">
                    <span className="tabular-nums shrink-0">{formatDate(tx.created_at)}</span>
                    {tx.notes && <span className="truncate" title={tx.notes}>· {tx.notes}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ruční úprava peněženky</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Počet bodů (kladné = přičíst, záporné = odečíst)</label>
              <Input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                placeholder="např. 500 nebo -200"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Poznámka (nepovinné)</label>
              <Textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Důvod úpravy…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>
              Zrušit
            </Button>
            <Button
              type="button"
              onClick={() => adjustMutation.mutate()}
              disabled={adjustMutation.isPending || !adjustPoints.trim()}
            >
              {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
