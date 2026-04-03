import { useState, useMemo, useEffect, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Pencil, Check, X, Share2, Copy, Trash2, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EU_COUNTRIES = [
  "Belgie", "Bulharsko", "Česko", "Dánsko", "Estonsko", "Finsko", "Francie",
  "Chorvatsko", "Irsko", "Itálie", "Kypr", "Litva", "Lotyšsko", "Lucembursko",
  "Maďarsko", "Malta", "Německo", "Nizozemsko", "Polsko", "Portugalsko",
  "Rakousko", "Rumunsko", "Řecko", "Slovensko", "Slovinsko", "Španělsko", "Švédsko",
];

const CANARY_EXCEPTIONS = ["Gran Canaria", "Tenerife", "Lanzarote", "Fuerteventura"];

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  try { return format(new Date(d), "dd.MM.yy"); } catch { return ""; }
};

const formatNum = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "";
  return Math.round(n).toLocaleString("cs-CZ");
};

const isInPreviousMonth = (dateStr: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const prev = subMonths(new Date(), 1);
  return d >= startOfMonth(prev) && d <= endOfMonth(prev);
};

export default function Accounting() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("all");
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounting", year, month],
    queryFn: async () => {
      const { data: contracts, error } = await supabase
        .from("travel_contracts")
        .select(`
          id, contract_number, status, total_price, sent_at, signed_at,
          accounting_buy_final_override,
          accounting_sell_deposit_locked, accounting_buy_deposit_locked,
          accounting_profit_deposit_locked, accounting_deposit_locked_at,
          client:clients!travel_contracts_client_id_fkey(first_name, last_name),
          deal:deals!travel_contracts_deal_id_fkey(
            id, start_date, end_date, total_price,
            destination:destinations!deals_destination_id_fkey(
              name,
              country:countries!destinations_country_id_fkey(name)
            )
          )
        `)
        .neq("status", "cancelled");

      if (error) throw error;
      if (!contracts) return [];

      const contractIds = contracts.map((c) => c.id);
      const { data: allPayments } = await supabase
        .from("contract_payments")
        .select("contract_id, payment_type, amount, paid, paid_at")
        .in("contract_id", contractIds);

      const dealIds = contracts
        .map((c) => (c.deal as any)?.id)
        .filter(Boolean);
      const { data: profitData } = await supabase
        .from("deal_profitability")
        .select("deal_id, total_costs, revenue")
        .in("deal_id", dealIds);

      const profitMap = new Map(
        (profitData || []).map((p) => [p.deal_id, p])
      );
      const paymentsMap = new Map<string, typeof allPayments>();
      (allPayments || []).forEach((p) => {
        const arr = paymentsMap.get(p.contract_id) || [];
        arr.push(p);
        paymentsMap.set(p.contract_id, arr);
      });

      return contracts
        .sort((a, b) => (a.contract_number || "").localeCompare(b.contract_number || "", "cs", { numeric: true }))
        .map((c) => {
          const deal = c.deal as any;
          const client = c.client as any;
          const dest = deal?.destination as any;
          const countryName = dest?.country?.name || "";
          const destName = dest?.name || "";
          const startDate = deal?.start_date || null;
          const endDate = deal?.end_date || null;

          if (startDate) {
            const sd = new Date(startDate);
            if (String(sd.getFullYear()) !== year) return null;
            if (month !== "all" && String(sd.getMonth() + 1) !== month) return null;
          } else {
            return null;
          }

          const payments = paymentsMap.get(c.id) || [];
          const prof = profitMap.get(deal?.id);
          const totalCosts = Number(prof?.total_costs || 0);
          const totalRevenue = Number(prof?.revenue || deal?.total_price || c.total_price || 0);

          const sellDeposit = totalRevenue;
          const buyDeposit = totalCosts;

          // Vyúčtování columns: show real values only if end date is in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPastTrip = endDate ? new Date(endDate) < today : false;

          const sellFinal = isPastTrip ? totalRevenue : 0;
          // Use override if set, otherwise use calculated costs
          const buyFinalOverride = (c as any).accounting_buy_final_override;
          const buyFinalCalc = buyFinalOverride != null ? Number(buyFinalOverride) : totalCosts;
          const buyFinal = isPastTrip ? buyFinalCalc : 0;
          const hasOverride = buyFinalOverride != null;

          const profitDeposit = sellDeposit - buyDeposit;
          const profitFinal = isPastTrip ? sellFinal - buyFinal : 0;

          const isEU = EU_COUNTRIES.includes(countryName);
          const isCanary = CANARY_EXCEPTIONS.some((ex) =>
            destName.toLowerCase().includes(ex.toLowerCase())
          );
          const vatRate = isEU && !isCanary ? 0.21 : 0;

          const vatDeposit = Math.round(profitDeposit * vatRate);
          const vatFinal = isPastTrip ? Math.round(profitFinal * vatRate) : 0;
          const vatDiff = isPastTrip ? vatFinal - vatDeposit : 0;

          const paidPayments = payments.filter((p) => p.paid && p.paid_at);
          const firstPaidAt = paidPayments.map((p) => p.paid_at!).sort()[0] || null;

          const highlightRed = isInPreviousMonth(endDate);
          // Modře pouze pokud je zaplacena právě jedna platba a ta je z minulého měsíce
          const highlightBlue = paidPayments.length === 1 && isInPreviousMonth(firstPaidAt);

          // Locked deposit values
          const lockedSell = (c as any).accounting_sell_deposit_locked;
          const lockedBuy = (c as any).accounting_buy_deposit_locked;
          const lockedProfit = (c as any).accounting_profit_deposit_locked;
          const lockedAt = (c as any).accounting_deposit_locked_at;
          const isLocked = lockedAt != null;

          return {
            contractId: c.id,
            dealId: deal?.id || null,
            contractNumber: c.contract_number,
            clientName: client ? `${client.first_name} ${client.last_name}` : "",
            country: countryName,
            destination: destName,
            from: startDate,
            to: endDate,
            sellDeposit: isLocked ? Number(lockedSell) : sellDeposit,
            buyDeposit: isLocked ? Number(lockedBuy) : buyDeposit,
            profitDeposit: isLocked ? Number(lockedProfit) : profitDeposit,
            // Raw calculated values for locking
            _rawSellDeposit: sellDeposit,
            _rawBuyDeposit: buyDeposit,
            _rawProfitDeposit: profitDeposit,
            sellFinal,
            buyFinal,
            hasOverride,
            profitFinal,
            vatDeposit: isLocked ? Math.round(Number(lockedProfit) * vatRate) : vatDeposit,
            vatFinal,
            vatDiff: isPastTrip ? vatFinal - (isLocked ? Math.round(Number(lockedProfit) * vatRate) : vatDeposit) : 0,
            highlightRed,
            highlightBlue,
            isLocked,
          };
        })
        .filter(Boolean);
    },
  });

  // Auto-lock deposit values when highlighted (blue/red) and not yet locked
  const lockingRef = useRef(false);
  useEffect(() => {
    if (lockingRef.current || !rows.length) return;
    const toLock = rows.filter(
      (r: any) => (r.highlightBlue || r.highlightRed) && !r.isLocked
    );
    if (!toLock.length) return;
    lockingRef.current = true;

    const lockAll = async () => {
      for (const r of toLock as any[]) {
        await supabase
          .from("travel_contracts")
          .update({
            accounting_sell_deposit_locked: r._rawSellDeposit,
            accounting_buy_deposit_locked: r._rawBuyDeposit,
            accounting_profit_deposit_locked: r._rawProfitDeposit,
            accounting_deposit_locked_at: new Date().toISOString(),
          } as any)
          .eq("id", r.contractId);
      }
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      lockingRef.current = false;
    };
    lockAll();
  }, [rows, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async ({ contractId, value }: { contractId: string; value: number | null }) => {
      const { error } = await supabase
        .from("travel_contracts")
        .update({ accounting_buy_final_override: value } as any)
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      toast.success("Nákup vyúčt. uložen");
    },
    onError: () => {
      toast.error("Chyba při ukládání");
    },
  });

  const handleEditStart = (contractId: string, currentValue: number) => {
    setEditingRow(contractId);
    setEditValue(String(Math.round(currentValue)));
  };

  const handleEditSave = (contractId: string) => {
    const num = editValue.trim() === "" ? null : Number(editValue.replace(/\s/g, ""));
    if (num !== null && isNaN(num)) {
      toast.error("Neplatná hodnota");
      return;
    }
    saveMutation.mutate({ contractId, value: num });
    setEditingRow(null);
  };

  const handleEditCancel = () => {
    setEditingRow(null);
    setEditValue("");
  };

  // Share link management
  const { data: existingShares = [] } = useQuery({
    queryKey: ["accounting-shares"],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounting_shares")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("accounting_shares")
        .insert({ year, month } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const url = `${window.location.origin}/accounting/share/${data.share_token}`;
      navigator.clipboard.writeText(url);
      toast.success("Odkaz vytvořen a zkopírován");
      queryClient.invalidateQueries({ queryKey: ["accounting-shares"] });
    },
    onError: () => toast.error("Chyba při vytváření odkazu"),
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounting_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-shares"] });
      toast.success("Odkaz smazán");
    },
  });

  const years = useMemo(() => {
    const y = [];
    for (let i = currentYear; i >= 2024; i--) y.push(String(i));
    return y;
  }, [currentYear]);

  const MONTHS_MAP: Record<string, string> = {
    "1": "Leden", "2": "Únor", "3": "Březen", "4": "Duben",
    "5": "Květen", "6": "Červen", "7": "Červenec", "8": "Srpen",
    "9": "Září", "10": "Říjen", "11": "Listopad", "12": "Prosinec",
  };

  const months = [
    { value: "all", label: "Všechny měsíce" },
    { value: "1", label: "Leden" }, { value: "2", label: "Únor" },
    { value: "3", label: "Březen" }, { value: "4", label: "Duben" },
    { value: "5", label: "Květen" }, { value: "6", label: "Červen" },
    { value: "7", label: "Červenec" }, { value: "8", label: "Srpen" },
    { value: "9", label: "Září" }, { value: "10", label: "Říjen" },
    { value: "11", label: "Listopad" }, { value: "12", label: "Prosinec" },
  ];

  const exportCsv = () => {
    const headers = [
      "Smlouva", "Klient", "Země", "Destinace", "Od", "Do",
      "Prodej záloha", "Nákup záloha", "Zisk záloha",
      "Prodej vyúčtování", "Nákup vyúčtování", "Zisk vyúčtování",
      "DPH záloha EU", "DPH vyúčtování EU", "Rozdíl proti odvodu",
    ];
    const csvRows = [headers.join(";")];
    rows.forEach((r: any) => {
      csvRows.push([
        r.contractNumber, r.clientName, r.country, r.destination,
        formatDateShort(r.from), formatDateShort(r.to),
        r.sellDeposit, r.buyDeposit, r.profitDeposit,
        r.sellFinal, r.buyFinal, r.profitFinal,
        r.vatDeposit, r.vatFinal, r.vatDiff,
      ].join(";"));
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ucetnictvi_${year}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell maxWidth="wide" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-heading-1">Účetnictví</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-1" /> Sdílet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sdílet účetnictví</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Vytvořte veřejný odkaz pro účetního. Odkaz zobrazí data pro vybraný rok a měsíc (read-only).
                  </p>
                  <Button onClick={() => createShareMutation.mutate()} disabled={createShareMutation.isPending}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Vytvořit odkaz pro {year} / {month === "all" ? "všechny měsíce" : months.find(m => m.value === month)?.label}
                  </Button>
                  {existingShares.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Existující odkazy:</p>
                      {existingShares.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                          <span className="flex-1 truncate">
                            {s.year} / {s.month === "all" ? "vše" : MONTHS_MAP[s.month] || s.month}
                          </span>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/accounting/share/${s.share_token}`);
                              toast.success("Zkopírováno");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => deleteShareMutation.mutate(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Načítám data…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Žádné smlouvy pro zvolené období</p>
        ) : (
          <>
            {/* Mobile: card view */}
            <div className="md:hidden space-y-3">
              {rows.map((r: any, i: number) => {
                const highlight = r.highlightRed
                  ? "border-l-4 border-l-red-400 bg-red-50 dark:bg-red-900/20"
                  : r.highlightBlue
                  ? "border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "";
                return (
                  <div key={i} className={`rounded-xl border bg-card p-4 space-y-3 ${highlight}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        {r.dealId ? (
                          <Link to={`/deals/${r.dealId}`} className="text-primary hover:underline">
                            {r.contractNumber}
                          </Link>
                        ) : r.contractNumber}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(r.from)} – {formatDateShort(r.to)}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground">{r.destination}{r.country ? ` · ${r.country}` : ""}</div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prodej zál.</div>
                        <div className="text-sm font-medium flex items-center gap-1">
                          {formatNum(r.sellDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Nákup zál.</div>
                        <div className="text-sm font-medium flex items-center gap-1">
                          {formatNum(r.buyDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Zisk zál.</div>
                        <div className="text-sm font-medium flex items-center gap-1">
                          {formatNum(r.profitDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prodej vyúčt.</div>
                        <div className="text-sm font-medium">{formatNum(r.sellFinal)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Nákup vyúčt.</div>
                        <div className="text-sm font-medium">
                          {editingRow === r.contractId ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 w-20 text-right text-xs"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleEditSave(r.contractId);
                                  if (e.key === "Escape") handleEditCancel();
                                }}
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditSave(r.contractId)}>
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={`${r.hasOverride ? "text-primary font-semibold" : ""} cursor-pointer`}
                              onClick={() => handleEditStart(r.contractId, r.buyFinal)}
                            >
                              {formatNum(r.buyFinal)} <Pencil className="h-3 w-3 inline opacity-40" />
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Zisk vyúčt.</div>
                        <div className="text-sm font-medium">{formatNum(r.profitFinal)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">DPH zál.</div>
                        <div className="text-sm">{formatNum(r.vatDeposit)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">DPH vyúčt.</div>
                        <div className="text-sm">{formatNum(r.vatFinal)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rozdíl</div>
                        <div className="text-sm">{formatNum(r.vatDiff)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table view */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Smlouva</TableHead>
                    <TableHead className="whitespace-nowrap">Klient</TableHead>
                    <TableHead className="whitespace-nowrap">Země</TableHead>
                    <TableHead className="whitespace-nowrap">Destinace</TableHead>
                    <TableHead className="whitespace-nowrap">Od</TableHead>
                    <TableHead className="whitespace-nowrap">Do</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Prodej zál.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Nákup zál.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Zisk zál.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Prodej vyúčt.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Nákup vyúčt.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Zisk vyúčt.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">DPH zál.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">DPH vyúčt.</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Rozdíl</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any, i: number) => (
                    <TableRow
                      key={i}
                      className={
                        r.highlightRed
                          ? "bg-red-200 dark:bg-red-800/60"
                          : r.highlightBlue
                          ? "bg-blue-200 dark:bg-blue-800/60"
                          : ""
                      }
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.dealId ? (
                          <Link to={`/deals/${r.dealId}`} className="text-primary underline-offset-2 hover:underline">
                            {r.contractNumber}
                          </Link>
                        ) : r.contractNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.clientName}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.country}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.destination}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateShort(r.from)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateShort(r.to)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {formatNum(r.sellDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground inline" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {formatNum(r.buyDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground inline" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {formatNum(r.profitDeposit)}
                          {r.isLocked && <Lock className="h-3 w-3 text-muted-foreground inline" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.sellFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap p-0">
                        {editingRow === r.contractId ? (
                          <div className="flex items-center gap-1 px-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-7 w-24 text-right text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleEditSave(r.contractId);
                                if (e.key === "Escape") handleEditCancel();
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditSave(r.contractId)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleEditCancel}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-end gap-1 px-4 py-2 cursor-pointer group hover:bg-muted/50 rounded"
                            onClick={() => handleEditStart(r.contractId, r.buyFinal)}
                          >
                            <span className={r.hasOverride ? "text-primary font-semibold" : ""}>
                              {formatNum(r.buyFinal)}
                            </span>
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.profitFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatDiff)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
    </PageShell>
  );
}
