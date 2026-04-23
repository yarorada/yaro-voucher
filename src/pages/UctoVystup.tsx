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
import { Archive, ChevronDown, ChevronUp, FileText, FolderOpen, ArrowRight, FileSignature, Download, Loader2, Mail, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { buildUctoZip, downloadBlob, type ZipInvoice, type ZipContract, type ZipBankStatement } from "@/lib/uctoZipBuilder";
import { BankStatementsCard, type BankStatement } from "@/components/BankStatementsCard";

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

type Contract = {
  id: string;
  contract_number: string;
  contract_date: string;
  total_price: number;
  currency: string | null;
  accounting_queued_at: string | null;
  accounting_batch_id: string | null;
  accounting_changed_after_archive: boolean | null;
  client?: { first_name: string | null; last_name: string | null } | null;
};

type Batch = {
  id: string;
  period: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  sent_to_accountant_at?: string | null;
  sent_to_accountant_email?: string | null;
  invoices?: Invoice[];
  contracts?: Contract[];
  bankStatements?: BankStatement[];
};

const DEFAULT_ACCOUNTANT_EMAIL = "altax4u@seznam.cz";

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

// Normalizuje měnu na ISO 4217 kód, který Intl.NumberFormat chápe.
// Některé staré faktury mají v DB symbol "Kč", "$" atd. místo "CZK"/"USD".
function normalizeCurrency(c: string | null | undefined): string {
  if (!c) return "CZK";
  const trimmed = c.trim();
  // Pokud je to už 3-znakový alfa kód (a tedy pravděpodobně ISO), použij ho
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  const map: Record<string, string> = {
    "Kč": "CZK", "kč": "CZK", "KČ": "CZK", "Kc": "CZK",
    "€": "EUR", "EU": "EUR",
    "$": "USD", "US$": "USD", "USD$": "USD",
    "£": "GBP",
    "zł": "PLN", "PLN zł": "PLN",
  };
  return map[trimmed] || "CZK";
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: normalizeCurrency(currency),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // poslední záchrana, kdyby normalizace neuměla
    return `${amount.toLocaleString("cs-CZ")} ${currency || ""}`.trim();
  }
}

function clientName(c: Contract) {
  const f = c.client?.first_name ?? "";
  const l = c.client?.last_name ?? "";
  return `${f} ${l}`.trim() || "—";
}

function InvoiceTable({ invoices, type, periodStart }: { invoices: Invoice[]; type: "issued" | "received"; periodStart?: string }) {
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
        {filtered.map((inv) => {
          const isCarryOver =
            !!periodStart &&
            type === "received" &&
            !inv.paid &&
            !!inv.issue_date &&
            inv.issue_date < periodStart;
          return (
            <TableRow key={inv.id}>
              <TableCell className="font-mono text-xs">
                {inv.invoice_number || "—"}
                {isCarryOver && (
                  <Badge className="ml-2 bg-amber-500 text-white text-[10px]" title="Nezaplacená faktura z dřívějšího období">
                    Nedoplatek
                  </Badge>
                )}
              </TableCell>
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
          );
        })}
      </TableBody>
    </Table>
  );
}

function ContractTable({ contracts, showChangedBadge = false }: { contracts: Contract[]; showChangedBadge?: boolean }) {
  if (contracts.length === 0)
    return <p className="text-sm text-muted-foreground py-4 text-center">Žádné smlouvy</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Číslo</TableHead>
          <TableHead>Klient</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Cena</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-mono text-xs">
              <Link to={`/contracts/${c.id}`} className="text-primary hover:underline">
                {c.contract_number}
              </Link>
              {showChangedBadge && c.accounting_changed_after_archive && (
                <Badge className="ml-2 bg-orange-500 text-white text-[10px]">Změněná</Badge>
              )}
            </TableCell>
            <TableCell className="text-sm">{clientName(c)}</TableCell>
            <TableCell className="text-sm">
              {c.contract_date ? format(new Date(c.contract_date + "T00:00:00"), "d.M.yyyy") : "—"}
            </TableCell>
            <TableCell className="text-right text-sm font-medium">
              {formatAmount(c.total_price, c.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BatchCard({ batch, onDownload, onSend, downloadingBatchId, downloadProgress, sendingBatchId }: {
  batch: Batch;
  onDownload: (b: Batch) => void;
  onSend: (b: Batch) => void;
  downloadingBatchId: string | null;
  downloadProgress: { current: number; total: number; label: string } | null;
  sendingBatchId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const issued = (batch.invoices || []).filter((i) => i.invoice_type === "issued");
  const received = (batch.invoices || []).filter((i) => i.invoice_type === "received");
  const contracts = batch.contracts || [];
  const bank = batch.bankStatements || [];
  const totalDocs = (batch.invoices || []).length + contracts.length + bank.length;
  const isDownloading = downloadingBatchId === batch.id;
  const isSending = sendingBatchId === batch.id;
  const wasSent = !!batch.sent_to_accountant_at;
  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => setOpen((v) => !v)}>
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="font-medium truncate">{batch.label || periodLabel(batch.period)}</span>
            <Badge variant="outline" className="text-xs">
              {totalDocs} dokladů
            </Badge>
            {contracts.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {contracts.length} smluv
              </Badge>
            )}
            {bank.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {bank.length} výpisů
              </Badge>
            )}
            {wasSent && (
              <Badge className="bg-emerald-600 text-white text-xs gap-1">
                <Check className="h-3 w-3" />
                Odesláno {format(new Date(batch.sent_to_accountant_at!), "d.M.")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8"
              disabled={isDownloading || totalDocs === 0}
              onClick={(e) => { e.stopPropagation(); onDownload(batch); }}
            >
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {isDownloading
                ? (downloadProgress ? `${downloadProgress.current}/${downloadProgress.total}` : "Stahuji…")
                : "ZIP"}
            </Button>
            <Button
              size="sm"
              variant={wasSent ? "outline" : "default"}
              className="gap-1 h-8"
              disabled={isSending || totalDocs === 0}
              onClick={(e) => { e.stopPropagation(); onSend(batch); }}
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {isSending ? "Odesílám…" : wasSent ? "Poslat znovu" : "Odeslat účetnímu"}
            </Button>
            <span className="hidden md:inline">Archivováno {format(new Date(batch.created_at), "d.M.yyyy")}</span>
            <button onClick={() => setOpen((v) => !v)} className="p-1 hover:bg-muted rounded">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {batch.notes && (
          <p className="text-xs text-muted-foreground mt-1">{batch.notes}</p>
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-4">
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
          {contracts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileSignature className="h-3.5 w-3.5" />
                Vystavené smlouvy ({contracts.length})
              </p>
              <ContractTable contracts={contracts} />
            </div>
          )}
          {bank.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Bankovní výpisy ({bank.length})
              </p>
              <ul className="space-y-1 text-sm">
                {bank.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/40">
                    <Badge variant="outline" className="text-[10px] uppercase">{b.bank}</Badge>
                    <span className="truncate flex-1">{b.file_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [sendingBatchId, setSendingBatchId] = useState<string | null>(null);
  const [sendDialogBatch, setSendDialogBatch] = useState<Batch | null>(null);
  const [sendEmail, setSendEmail] = useState(DEFAULT_ACCOUNTANT_EMAIL);
  const [sendNotes, setSendNotes] = useState("");

  // Faktury pro vybrané období (bez přiřazení do dávky).
  // Logika:
  //   - vystavené faktury: jen ty s issue_date v daném měsíci
  //   - přijaté faktury: ty s issue_date v daném měsíci
  //                      PLUS všechny nezaplacené přijaté z dřívějších měsíců
  //                      (carry-forward, ať nezaplacený závazek účetnímu nikdy nevypadne)
  const { data: pendingInvoices = [], isLoading } = useQuery({
    queryKey: ["ucto-pending", period],
    queryFn: async () => {
      const start = format(startOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const end = format(endOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const baseSelect =
        "id, invoice_number, invoice_type, issue_date, client_name, supplier_name, total_amount, currency, paid, accounting_batch_id";

      const [{ data: inPeriod, error: e1 }, { data: unpaidReceived, error: e2 }] = await Promise.all([
        // 1) vše vystavené v tomto měsíci (oboje typy)
        (supabase as any)
          .from("invoices")
          .select(baseSelect)
          .gte("issue_date", start)
          .lte("issue_date", end)
          .is("accounting_batch_id", null),
        // 2) všechny nezaplacené přijaté faktury vystavené do konce tohoto měsíce
        //    (zachytí jak aktuální měsíc, tak nedoplatky z minulých měsíců)
        (supabase as any)
          .from("invoices")
          .select(baseSelect)
          .eq("invoice_type", "received")
          .lte("issue_date", end)
          .is("accounting_batch_id", null)
          .or("paid.is.false,paid.is.null"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      // Sloučit a deduplikovat podle id
      const map = new Map<string, Invoice>();
      for (const i of (inPeriod || []) as Invoice[]) map.set(i.id, i);
      for (const i of (unpaidReceived || []) as Invoice[]) map.set(i.id, i);
      // Seřadit podle issue_date vzestupně
      return Array.from(map.values()).sort((a, b) =>
        (a.issue_date || "").localeCompare(b.issue_date || "")
      );
    },
    enabled: !!user,
  });

  // Smlouvy zařazené pro vybrané období (queued v daném měsíci, ještě nezařazené do nové dávky)
  const { data: pendingContracts = [] } = useQuery({
    queryKey: ["ucto-pending-contracts", period],
    queryFn: async () => {
      const start = format(startOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const end = format(endOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const { data, error } = await (supabase as any)
        .from("travel_contracts")
        .select("id, contract_number, contract_date, total_price, currency, accounting_queued_at, accounting_batch_id, accounting_changed_after_archive, client:clients(first_name, last_name)")
        .gte("accounting_queued_at", start + "T00:00:00")
        .lte("accounting_queued_at", end + "T23:59:59")
        // buď nikdy nearchivovaná, nebo archivovaná ale po archivaci změněná → re-queue
        .or("accounting_batch_id.is.null,accounting_changed_after_archive.eq.true")
        .order("accounting_queued_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Contract[];
    },
    enabled: !!user,
  });

  // Bankovní výpisy pro vybrané období (nezařazené do dávky)
  const { data: pendingBankStatements = [] } = useQuery({
    queryKey: ["ucto-bank-statements", period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_statements")
        .select("*")
        .eq("period", period)
        .is("accounting_batch_id", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BankStatement[];
    },
    enabled: !!user,
  });

  // Archivované dávky (faktury + smlouvy + výpisy)
  const { data: batches = [] } = useQuery({
    queryKey: ["ucto-batches"],
    queryFn: async () => {
      const { data: batchData, error } = await (supabase as any)
        .from("accounting_batches")
        .select("id, period, label, notes, created_at, sent_to_accountant_at, sent_to_accountant_email")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!batchData?.length) return [] as Batch[];

      const batchIds = batchData.map((b: Batch) => b.id);

      const [{ data: invData }, { data: contractData }, { data: bankData }] = await Promise.all([
        (supabase as any)
          .from("invoices")
          .select("id, invoice_number, invoice_type, issue_date, client_name, supplier_name, total_amount, currency, paid, accounting_batch_id")
          .in("accounting_batch_id", batchIds),
        (supabase as any)
          .from("travel_contracts")
          .select("id, contract_number, contract_date, total_price, currency, accounting_queued_at, accounting_batch_id, accounting_changed_after_archive, client:clients(first_name, last_name)")
          .in("accounting_batch_id", batchIds)
          // pouze ty, co po archivaci NEbyly změněny (změněné už visí v aktuální složce)
          .eq("accounting_changed_after_archive", false),
        (supabase as any)
          .from("bank_statements")
          .select("*")
          .in("accounting_batch_id", batchIds),
      ]);

      const invByBatch: Record<string, Invoice[]> = {};
      for (const inv of invData || []) {
        if (!invByBatch[inv.accounting_batch_id]) invByBatch[inv.accounting_batch_id] = [];
        invByBatch[inv.accounting_batch_id].push(inv);
      }
      const contractsByBatch: Record<string, Contract[]> = {};
      for (const c of contractData || []) {
        if (!contractsByBatch[c.accounting_batch_id]) contractsByBatch[c.accounting_batch_id] = [];
        contractsByBatch[c.accounting_batch_id].push(c);
      }
      const bankByBatch: Record<string, BankStatement[]> = {};
      for (const bs of bankData || []) {
        if (!bankByBatch[bs.accounting_batch_id]) bankByBatch[bs.accounting_batch_id] = [];
        bankByBatch[bs.accounting_batch_id].push(bs);
      }

      return batchData.map((b: Batch) => ({
        ...b,
        invoices: invByBatch[b.id] || [],
        contracts: contractsByBatch[b.id] || [],
        bankStatements: bankByBatch[b.id] || [],
      })) as Batch[];
    },
    enabled: !!user,
  });

  /* ---------- ZIP download ---------- */

  const folderSlug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const fetchInvoicesFull = async (ids: string[]): Promise<ZipInvoice[]> => {
    if (!ids.length) return [];
    const { data, error } = await (supabase as any)
      .from("invoices")
      .select(
        "id, invoice_number, invoice_type, client_name, client_address, supplier_name, supplier_address, supplier_ico, supplier_dic, client_ico, client_dic, issue_date, due_date, taxable_date, total_amount, net_amount, vat_amount, currency, variable_symbol, specific_symbol, constant_symbol, bank_account, iban, paid, notes, file_url, file_name, payment_method, bank, items"
      )
      .in("id", ids);
    if (error) throw error;
    return (data || []) as ZipInvoice[];
  };

  const toZipBankStatements = (rows: BankStatement[]): ZipBankStatement[] =>
    rows.map((r) => ({
      id: r.id,
      bank: r.bank,
      file_url: r.file_url,
      file_name: r.file_name,
      uploaded_at: r.uploaded_at,
    }));

  const fetchContractsFull = async (ids: string[]): Promise<ZipContract[]> => {
    if (!ids.length) return [];
    // Fetch the same deep object that ContractDetail.tsx uses, so the branded
    // ContractPdfTemplate renders identically (services, travelers, payments, ...).
    const { data, error } = await (supabase as any)
      .from("travel_contracts")
      .select(`
        *,
        client:clients(*),
        payments:contract_payments(*),
        deal:deals(
          id,
          *,
          destination:destinations(
            name,
            country:countries(name, iso_code)
          ),
          travelers:deal_travelers(
            client:clients(*)
          ),
          services:deal_services(
            *,
            supplier:suppliers(name)
          )
        )
      `)
      .in("id", ids);
    if (error) throw error;
    return (data || []) as ZipContract[];
  };

  const runDownload = async (
    batchId: string,
    folderName: string,
    invoiceIds: string[],
    contractIds: string[],
    bankStatements: BankStatement[]
  ) => {
    if (invoiceIds.length + contractIds.length + bankStatements.length === 0) {
      toast.error("Žádné doklady k zabalení");
      return;
    }
    setDownloadingBatchId(batchId);
    setDownloadProgress({ current: 0, total: invoiceIds.length + contractIds.length + bankStatements.length + 1, label: "Načítám doklady…" });
    try {
      const [invoices, contracts] = await Promise.all([
        fetchInvoicesFull(invoiceIds),
        fetchContractsFull(contractIds),
      ]);
      const blob = await buildUctoZip(
        { folderName, invoices, contracts, bankStatements: toZipBankStatements(bankStatements) },
        (p) => setDownloadProgress(p)
      );
      downloadBlob(blob, `${folderName}.zip`);
      toast.success("ZIP balíček byl stažen");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Nepodařilo se vytvořit ZIP";
      console.error(e);
      toast.error(msg);
    } finally {
      setDownloadingBatchId(null);
      setDownloadProgress(null);
    }
  };

  const handleDownloadBatch = async (b: Batch) => {
    const folderName = `UCTO_${b.period}_${folderSlug(b.label || periodLabel(b.period))}`;
    await runDownload(
      b.id,
      folderName,
      (b.invoices || []).map((i) => i.id),
      (b.contracts || []).map((c) => c.id),
      b.bankStatements || []
    );
  };

  /* ---------- Send to accountant ---------- */

  const handleOpenSend = (b: Batch) => {
    setSendDialogBatch(b);
    setSendEmail(b.sent_to_accountant_email || DEFAULT_ACCOUNTANT_EMAIL);
    setSendNotes("");
  };

  const handleConfirmSend = async () => {
    const b = sendDialogBatch;
    if (!b || !user) return;
    if (!sendEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendEmail)) {
      toast.error("Zadej platný e-mail účetního");
      return;
    }
    const invoiceIds = (b.invoices || []).map((i) => i.id);
    const contractIds = (b.contracts || []).map((c) => c.id);
    const bank = b.bankStatements || [];
    if (invoiceIds.length + contractIds.length + bank.length === 0) {
      toast.error("Dávka neobsahuje žádné doklady");
      return;
    }

    setSendingBatchId(b.id);
    setSendDialogBatch(null);
    setDownloadingBatchId(b.id); // ZIP build progress reused
    setDownloadProgress({ current: 0, total: invoiceIds.length + contractIds.length + bank.length + 1, label: "Načítám doklady…" });

    try {
      // 1) build ZIP
      const folderName = `UCTO_${b.period}_${folderSlug(b.label || periodLabel(b.period))}`;
      const [invoices, contracts] = await Promise.all([
        fetchInvoicesFull(invoiceIds),
        fetchContractsFull(contractIds),
      ]);
      const zipBlob = await buildUctoZip(
        { folderName, invoices, contracts, bankStatements: toZipBankStatements(bank) },
        (p) => setDownloadProgress(p)
      );
      setDownloadProgress({ current: 0, total: 0, label: "Nahrávám ZIP…" });

      // 2) upload to ucto-archives
      const zipPath = `${user.id}/${folderName}.zip`;
      const { error: upErr } = await supabase.storage
        .from("ucto-archives")
        .upload(zipPath, zipBlob, {
          contentType: "application/zip",
          upsert: true,
        });
      if (upErr) throw new Error(`Nahrání ZIPu selhalo: ${upErr.message}`);

      // 3) summary
      const issuedInv = (b.invoices || []).filter((i) => i.invoice_type === "issued");
      const receivedInv = (b.invoices || []).filter((i) => i.invoice_type === "received");
      const summary = {
        issued_count: issuedInv.length,
        received_count: receivedInv.length,
        contracts_count: (b.contracts || []).length,
        issued_total: issuedInv.reduce((s, i) => s + (i.total_amount || 0), 0),
        received_total: receivedInv.reduce((s, i) => s + (i.total_amount || 0), 0),
        contracts_total: (b.contracts || []).reduce((s, c) => s + (c.total_price || 0), 0),
        currency: "CZK",
      };

      // 4) call edge function
      setDownloadProgress({ current: 0, total: 0, label: "Odesílám e-mail…" });
      const { data, error: fnErr } = await supabase.functions.invoke("send-ucto-to-accountant", {
        body: {
          batch_id: b.id,
          folder_name: folderName,
          zip_path: zipPath,
          zip_size_bytes: zipBlob.size,
          recipient_email: sendEmail,
          notes: sendNotes || undefined,
          summary,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);

      toast.success(`Odesláno účetnímu (${sendEmail})`);
      qc.invalidateQueries({ queryKey: ["ucto-batches"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Odeslání se nezdařilo";
      console.error(e);
      toast.error(msg);
    } finally {
      setSendingBatchId(null);
      setDownloadingBatchId(null);
      setDownloadProgress(null);
    }
  };

  const handleDownloadCurrent = async () => {
    const folderName = `UCTO_${period}_${folderSlug(periodLabel(period))}_aktualni`;
    await runDownload(
      "__current__",
      folderName,
      pendingInvoices.map((i) => i.id),
      pendingContracts.map((c) => c.id),
      pendingBankStatements
    );
  };

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nepřihlášen");
      if (pendingInvoices.length === 0 && pendingContracts.length === 0 && pendingBankStatements.length === 0)
        throw new Error("Žádné doklady k archivaci");

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

      // Přiřaď faktury — ALE ne carry-over nedoplatky (nezaplacené přijaté
      // vystavené před tímto měsícem). Ty zůstanou viditelné v aktuální složce
      // dál, dokud nebudou zaplaceny — patří do dávky toho měsíce, kdy byly vystaveny.
      const periodStart = format(startOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd");
      const archivableInvoices = pendingInvoices.filter((i) => {
        const isCarryOver =
          i.invoice_type === "received" &&
          !i.paid &&
          !!i.issue_date &&
          i.issue_date < periodStart;
        return !isCarryOver;
      });
      if (archivableInvoices.length > 0) {
        const invIds = archivableInvoices.map((i) => i.id);
        const { error: updErr } = await (supabase as any)
          .from("invoices")
          .update({ accounting_batch_id: batch.id })
          .in("id", invIds);
        if (updErr) throw updErr;
      }

      // Přiřaď smlouvy + vyresetuj flag změny
      if (pendingContracts.length > 0) {
        const cIds = pendingContracts.map((c) => c.id);
        const { error: cErr } = await (supabase as any)
          .from("travel_contracts")
          .update({
            accounting_batch_id: batch.id,
            accounting_changed_after_archive: false,
          })
          .in("id", cIds);
        if (cErr) throw cErr;
      }

      // Přiřaď bankovní výpisy
      if (pendingBankStatements.length > 0) {
        const bsIds = pendingBankStatements.map((b) => b.id);
        const { error: bsErr } = await (supabase as any)
          .from("bank_statements")
          .update({ accounting_batch_id: batch.id })
          .in("id", bsIds);
        if (bsErr) throw bsErr;
      }
    },
    onSuccess: () => {
      toast.success("Měsíc uzavřen a doklady archivovány");
      setArchiveDialogOpen(false);
      setArchiveNotes("");
      qc.invalidateQueries({ queryKey: ["ucto-pending"] });
      qc.invalidateQueries({ queryKey: ["ucto-pending-contracts"] });
      qc.invalidateQueries({ queryKey: ["ucto-bank-statements"] });
      qc.invalidateQueries({ queryKey: ["ucto-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issued = useMemo(() => pendingInvoices.filter((i) => i.invoice_type === "issued"), [pendingInvoices]);
  const received = useMemo(() => pendingInvoices.filter((i) => i.invoice_type === "received"), [pendingInvoices]);
  const newContracts = useMemo(
    () => pendingContracts.filter((c) => !c.accounting_changed_after_archive),
    [pendingContracts]
  );
  const changedContracts = useMemo(
    () => pendingContracts.filter((c) => c.accounting_changed_after_archive),
    [pendingContracts]
  );

  const sumAmount = (invs: Invoice[]) =>
    invs.reduce((s, i) => s + (i.total_amount || 0), 0);
  const sumContracts = (cs: Contract[]) =>
    cs.reduce((s, c) => s + (c.total_price || 0), 0);

  const totalPending = pendingInvoices.length + pendingContracts.length + pendingBankStatements.length;

  return (
    <PageShell>
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
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Vydané: <strong>{issued.length}</strong></span>
                <span>Přijaté: <strong>{received.length}</strong></span>
                <span>Smlouvy: <strong>{newContracts.length}</strong></span>
                {changedContracts.length > 0 && (
                  <span className="text-orange-600 dark:text-orange-400">
                    Změněné smlouvy: <strong>{changedContracts.length}</strong>
                  </span>
                )}
                <span>Výpisy: <strong>{pendingBankStatements.length}</strong></span>
              </div>
              <div className="sm:ml-auto flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadCurrent}
                  disabled={totalPending === 0 || downloadingBatchId === "__current__"}
                  className="gap-2"
                >
                  {downloadingBatchId === "__current__" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloadingBatchId === "__current__"
                    ? downloadProgress
                      ? `${downloadProgress.current}/${downloadProgress.total}`
                      : "Stahuji…"
                    : "Stáhnout ZIP"}
                </Button>
                <Button
                  onClick={() => setArchiveDialogOpen(true)}
                  disabled={totalPending === 0}
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" />
                  Uzavřít a archivovat
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <BankStatementsCard period={period} />

            {isLoading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Načítám…</p>
            ) : pendingInvoices.length === 0 && pendingContracts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    Žádné faktury ani smlouvy pro {periodLabel(period)}
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    Buď byly již archivovány, nebo v tomto měsíci nebyly vystaveny faktury / přijaty platby ke smlouvám.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
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
                      <InvoiceTable
                        invoices={pendingInvoices}
                        type="received"
                        periodStart={format(startOfMonth(parse(period, "yyyy-MM", new Date())), "yyyy-MM-dd")}
                      />
                    </CardContent>
                  </Card>
                </div>

                {(newContracts.length > 0 || changedContracts.length > 0) && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {newContracts.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <FileSignature className="h-4 w-4 text-purple-600" />
                              Vystavené smlouvy
                            </span>
                            <span className="text-sm font-normal text-muted-foreground">
                              {formatAmount(sumContracts(newContracts), "CZK")}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ContractTable contracts={newContracts} />
                        </CardContent>
                      </Card>
                    )}
                    {changedContracts.length > 0 && (
                      <Card className="border-orange-300 dark:border-orange-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <FileSignature className="h-4 w-4 text-orange-600" />
                              Změněné smlouvy
                            </span>
                            <span className="text-sm font-normal text-muted-foreground">
                              {formatAmount(sumContracts(changedContracts), "CZK")}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ContractTable contracts={changedContracts} showChangedBadge />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
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
              batches.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  onDownload={handleDownloadBatch}
                  onSend={handleOpenSend}
                  downloadingBatchId={downloadingBatchId}
                  downloadProgress={downloadProgress}
                  sendingBatchId={sendingBatchId}
                />
              ))
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
              Bude archivováno <strong>{pendingInvoices.length} faktur</strong> ({issued.length} vydaných,{" "}
              {received.length} přijatých)
              {pendingContracts.length > 0 && (
                <> a <strong>{pendingContracts.length} smluv</strong>
                  {changedContracts.length > 0 && (
                    <> (z toho {changedContracts.length} změněných)</>
                  )}
                </>
              )}
              {pendingBankStatements.length > 0 && (
                <> a <strong>{pendingBankStatements.length} bankovních výpisů</strong></>
              )}
              . Tyto doklady se již v příští složce neobjeví.
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

      {/* Dialog odeslání účetnímu */}
      <Dialog open={!!sendDialogBatch} onOpenChange={(o) => !o && setSendDialogBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Odeslat účetnímu — {sendDialogBatch?.label || (sendDialogBatch && periodLabel(sendDialogBatch.period))}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              ZIP balíček se nahraje do soukromého úložiště a účetnímu se pošle e-mail
              s odkazem (platnost 30 dní). Nic se neposílá jako příloha — žádné limity velikosti.
            </p>
            {sendDialogBatch?.sent_to_accountant_at && (
              <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                Tato dávka už byla odeslána{" "}
                <b>{format(new Date(sendDialogBatch.sent_to_accountant_at), "d.M.yyyy HH:mm")}</b>
                {sendDialogBatch.sent_to_accountant_email ? <> na <b>{sendDialogBatch.sent_to_accountant_email}</b></> : null}.
                Odesláním znovu se přepíše ZIP v archivu.
              </div>
            )}
            <div>
              <Label>E-mail účetní</Label>
              <Input
                type="email"
                className="mt-1"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="ucetni@example.cz"
              />
            </div>
            <div>
              <Label>Poznámka v e-mailu (volitelné)</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={sendNotes}
                onChange={(e) => setSendNotes(e.target.value)}
                placeholder="Např. tento měsíc obsahuje 2 stornofaktury…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogBatch(null)}>
              Zrušit
            </Button>
            <Button onClick={handleConfirmSend} className="gap-2">
              <Mail className="h-4 w-4" />
              Odeslat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
