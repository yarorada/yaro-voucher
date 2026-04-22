import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { cs } from "date-fns/locale";
import { Archive, ChevronDown, ChevronUp, FileText, FolderOpen, ArrowRight } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_type: string;
  issue_date: string | null;
  client_name: string | null;
  supplier_name: string | null;
  total_amount: number | null;
  currency: string | null;
  paid: boolean | null;
  accounting_batch_id: string | null;
};

type Batch = {
  id: string;
  period: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  invoices?: Invoice[];
};

function periodLabel(period: string): string {
  const d = parse(period, "yyyy-MM", new Date());
  return format(d, "LLLL yyyy", { locale: cs });
}

function periodOptions(): { value: string; label: string }[] {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = format(d, "yyyy-MM");
    opts.push({ value, label: periodLabel(value) });
  }
  return opts;
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currency || "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function InvoiceTable({ invoices, type }: { invoices: Invoice[]; type: "issued" | "received" }) {
  const filtered = invoices.filter((i) => i.invoice_type === type);
  if (filtered.length === 0)
    return <p className="text-sm text-muted-foreground py-4 text-center">Žádné faktury</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Číslo</TableHead>
          <TableHead>{type === "issued" ? "Klient" : "Dodavatel"}</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Částka</TableHead>
          <TableHead>Stav</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-mono text-xs">{inv.invoice_number || "—"}</TableCell>
            <TableCell className="text-sm">
              {type === "issued" ? inv.client_name : inv.supplier_name || "—"}
            </TableCell>
            <TableCell className="text-sm">
              {inv.issue_date ? format(new Date(inv.issue_date + "T00:00:00"), "d.M.yyyy") : "—"}
            </TableCell>
            <TableCell className="text-right text-sm font-medium">
              {formatAmount(inv.total_amount, inv.currency)}
            </TableCell>
            <TableCell>
              <Badge variant={inv.paid ? "default" : "secondary"} className="text-xs">
                {inv.paid ? "Uhrazena" : "Neuhrazena"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BatchCard({ batch }: { batch: Batch }) {
  const [open, setOpen] = useState(false);
  const issued = (batch.invoices || []).filter((i) => i.invoice_type === "issued");
  const received = (batch.invoices || []).filter((i) => i.invoice_type === "received");
  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{batch.label || periodLabel(batch.period)}</span>
            <Badge variant="outline" className="text-xs">
              {(batch.invoices || []).length} dokladů
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Archivováno {format(new Date(batch.created_at), "d.M.yyyy")}</span>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
        {batch.notes && (
          <p className="text-xs text-muted-foreground mt-1">{batch.notes}</p>
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Vydané ({issued.length})
              </p>
              <InvoiceTable invoices={batch.invoices || []} type="issued" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Přijaté ({received.length})
              </p>
              <InvoiceTable invoices={batch.invoices || []} type="received" />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function UctoVystup() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const defaultPeriod = format(new Date(), "yyyy-MM");
  const [period, setPeriod] = useState(defaultPeriod);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveNotes, setArchiveNotes] = useState("");

  // Faktury pro vybrané období (bez přiřazení do dávky)
  const { data: pendingInvoices = [], isLoading } = useQuery({
    queryKey: ["ucto-pending", period],
    queryFn: async () => {
      const start = format(startOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const end = format(endOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, invoice_type, issue_date, client_name, supplier_name, total_amount, currency, paid, accounting_batch_id")
        .gte("issue_date", start)
        .lte("issue_date", end)
        .is("accounting_batch_id", null)
        .order("issue_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!user,
  });

  // Archivované dávky
  const { data: batches = [] } = useQuery({
    queryKey: ["ucto-batches"],
    queryFn: async () => {
      const { data: batchData, error } = await (supabase as any)
        .from("accounting_batches")
        .select("id, period, label, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!batchData?.length) return [] as Batch[];

      const batchIds = batchData.map((b: Batch) => b.id);
      const { data: invData } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, invoice_type, issue_date, client_name, supplier_name, total_amount, currency, paid, accounting_batch_id")
        .in("accounting_batch_id", batchIds);

      const invByBatch: Record<string, Invoice[]> = {};
      for (const inv of invData || []) {
        if (!invByBatch[inv.accounting_batch_id]) invByBatch[inv.accounting_batch_id] = [];
        invByBatch[inv.accounting_batch_id].push(inv);
      }

      return batchData.map((b: Batch) => ({ ...b, invoices: invByBatch[b.id] || [] })) as Batch[];
    },
    enabled: !!user,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nepřihlášen");
      if (pendingInvoices.length === 0) throw new Error("Žádné faktury k archivaci");

      // Vytvoř dávku
      const { data: batch, error: batchErr } = await (supabase as any)
        .from("accounting_batches")
        .insert({
          user_id: user.id,
          period,
          label: periodLabel(period),
          notes: archiveNotes || null,
        })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      // Přiřaď faktury do dávky
      const ids = pendingInvoices.map((i) => i.id);
      const { error: updErr } = await (supabase as any)
        .from("invoices")
        .update({ accounting_batch_id: batch.id })
        .in("id", ids);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Měsíc uzavřen a doklady archivovány");
      setArchiveDialogOpen(false);
      setArchiveNotes("");
      qc.invalidateQueries({ queryKey: ["ucto-pending"] });
      qc.invalidateQueries({ queryKey: ["ucto-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issued = useMemo(() => pendingInvoices.filter((i) => i.invoice_type === "issued"), [pendingInvoices]);
  const received = useMemo(() => pendingInvoices.filter((i) => i.invoice_type === "received"), [pendingInvoices]);

  const sumAmount = (invs: Invoice[]) =>
    invs.reduce((s, i) => s + (i.total_amount || 0), 0);

  return (
    <PageShell title="UCTO výstup">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <Tabs defaultValue="current">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="current">Aktuální složka</TabsTrigger>
              <TabsTrigger value="archive">
                Archiv
                {batches.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {batches.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ---- Aktuální složka ---- */}
          <TabsContent value="current" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions().map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3 text-sm text-muted-foreground">
                <span>
                  Vydané: <strong>{issued.length}</strong>
                </span>
                <span>
                  Přijaté: <strong>{received.length}</strong>
                </span>
              </div>
              <div className="sm:ml-auto">
                <Button
                  onClick={() => setArchiveDialogOpen(true)}
                  disabled={pendingInvoices.length === 0}
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" />
                  Uzavřít a archivovat
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Načítám…</p>
            ) : pendingInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    Žádné neodeslané doklady pro {periodLabel(period)}
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    Buď byly již archivovány, nebo v tomto měsíci nebyly vystaveny žádné faktury.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      Vydané faktury
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatAmount(sumAmount(issued), "CZK")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <InvoiceTable invoices={pendingInvoices} type="issued" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      Přijaté faktury
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatAmount(sumAmount(received), "CZK")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <InvoiceTable invoices={pendingInvoices} type="received" />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ---- Archiv ---- */}
          <TabsContent value="archive">
            {batches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Archive className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Zatím žádný archivovaný měsíc</p>
                </CardContent>
              </Card>
            ) : (
              batches.map((b) => <BatchCard key={b.id} batch={b} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog archivace */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uzavřít {periodLabel(period)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Bude archivováno <strong>{pendingInvoices.length} dokladů</strong> ({issued.length} vydaných,{" "}
              {received.length} přijatých). Tyto doklady se již v příští složce neobjeví.
            </p>
            <div>
              <Label>Poznámka pro účetní (volitelné)</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={archiveNotes}
                onChange={(e) => setArchiveNotes(e.target.value)}
                placeholder="Např. nezapomeň na zálohu č. 123…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Zrušit
            </Button>
            <Button
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {archiveMutation.isPending ? "Archivuji…" : "Archivovat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
