import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Pencil, Check, X, Share2, Copy, Trash2 } from "lucide-react";
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
          const sellFinal = totalRevenue;
          // Use override if set, otherwise use calculated costs
          const buyFinalOverride = (c as any).accounting_buy_final_override;
          const buyFinal = buyFinalOverride != null ? Number(buyFinalOverride) : totalCosts;
          const hasOverride = buyFinalOverride != null;

          const profitDeposit = sellDeposit - buyDeposit;
          const profitFinal = sellFinal - buyFinal;

          const isEU = EU_COUNTRIES.includes(countryName);
          const isCanary = CANARY_EXCEPTIONS.some((ex) =>
            destName.toLowerCase().includes(ex.toLowerCase())
          );
          const vatRate = isEU && !isCanary ? 0.21 : 0;

          const vatDeposit = Math.round(profitDeposit * vatRate);
          const vatFinal = Math.round(profitFinal * vatRate);
          const vatDiff = vatFinal - vatDeposit;

          const firstPaidAt = payments
            .filter((p) => p.paid && p.paid_at)
            .map((p) => p.paid_at!)
            .sort()[0] || null;

          const highlightRed = isInPreviousMonth(endDate);
          const highlightBlue = isInPreviousMonth(firstPaidAt);

          return {
            contractId: c.id,
            contractNumber: c.contract_number,
            clientName: client ? `${client.first_name} ${client.last_name}` : "",
            country: countryName,
            destination: destName,
            from: startDate,
            to: endDate,
            sellDeposit,
            buyDeposit,
            sellFinal,
            buyFinal,
            hasOverride,
            profitDeposit,
            profitFinal,
            vatDeposit,
            vatFinal,
            vatDiff,
            highlightRed,
            highlightBlue,
          };
        })
        .filter(Boolean);
    },
  });

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
    <div className="p-4 md:p-6">
      <div className="container max-w-[1600px] mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-2xl font-bold">Účetnictví</h1>
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
        ) : (
          <div className="border rounded-lg overflow-x-auto">
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
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                      Žádné smlouvy pro zvolené období
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any, i: number) => (
                    <TableRow
                      key={i}
                      className={
                        r.highlightRed
                          ? "bg-red-50 dark:bg-red-950/30"
                          : r.highlightBlue
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : ""
                      }
                    >
                      <TableCell className="whitespace-nowrap font-medium">{r.contractNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.clientName}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.country}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.destination}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateShort(r.from)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateShort(r.to)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.sellDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.buyDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(r.profitDeposit)}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
