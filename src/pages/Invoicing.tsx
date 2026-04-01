import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Copy, QrCode, ExternalLink, Pencil, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { generatePaymentQrDataUrl, bankAccountToIban, generateSpaydString } from "@/lib/spayd";
import QRCode from "qrcode";

const DEFAULT_BANK_ACCOUNT = "227993932/0600";

type Invoice = {
  id: string;
  user_id: string;
  invoice_type: string;
  invoice_number: string | null;
  supplier_id: string | null;
  deal_id: string | null;
  deal_supplier_invoice_id: string | null;
  client_name: string | null;
  client_ico: string | null;
  client_dic: string | null;
  client_address: string | null;
  supplier_name: string | null;
  supplier_ico: string | null;
  supplier_dic: string | null;
  supplier_address: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid: boolean | null;
  paid_at: string | null;
  variable_symbol: string | null;
  bank_account: string | null;
  iban: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  payment_method: string | null;
  created_at: string;
};

const emptyForm = {
  invoice_type: "issued" as string,
  invoice_number: "",
  supplier_id: "",
  client_name: "",
  client_ico: "",
  client_dic: "",
  client_address: "",
  supplier_name: "",
  supplier_ico: "",
  supplier_dic: "",
  supplier_address: "",
  total_amount: "",
  currency: "CZK",
  issue_date: format(new Date(), "yyyy-MM-dd"),
  due_date: "",
  variable_symbol: "",
  bank_account: DEFAULT_BANK_ACCOUNT,
  iban: "",
  notes: "",
};

export default function Invoicing() {
  const [tab, setTab] = useState("received");
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aresLoading, setAresLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrDialogInvoice, setQrDialogInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, email, address, street, city, postal_code, country_name").order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingInvoice) {
        const { error } = await supabase.from("invoices").update(values).eq("id", editingInvoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(editingInvoice ? "Faktura aktualizována" : "Faktura vytvořena");
      setShowForm(false);
      setEditingInvoice(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura smazána");
    },
  });

  const handleAresLookup = async (ico: string) => {
    if (!ico || ico.length < 2) return;
    setAresLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ares-lookup", {
        body: { ico },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (tab === "issued" || form.invoice_type === "issued") {
        setForm((f) => ({
          ...f,
          client_name: data.name || f.client_name,
          client_ico: data.ico || f.client_ico,
          client_dic: data.dic || f.client_dic,
          client_address: data.address || f.client_address,
        }));
      } else {
        setForm((f) => ({
          ...f,
          supplier_name: data.name || f.supplier_name,
          supplier_ico: data.ico || f.supplier_ico,
          supplier_dic: data.dic || f.supplier_dic,
          supplier_address: data.address || f.supplier_address,
        }));
      }
      toast.success("Údaje doplněny z ARES");
    } catch {
      toast.error("Nepodařilo se načíst údaje z ARES");
    } finally {
      setAresLoading(false);
    }
  };

  const handleSubmit = () => {
    const values: any = {
      invoice_type: form.invoice_type,
      invoice_number: form.invoice_number || null,
      supplier_id: form.supplier_id || null,
      client_name: form.client_name || null,
      client_ico: form.client_ico || null,
      client_dic: form.client_dic || null,
      client_address: form.client_address || null,
      supplier_name: form.supplier_name || null,
      supplier_ico: form.supplier_ico || null,
      supplier_dic: form.supplier_dic || null,
      supplier_address: form.supplier_address || null,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      currency: form.currency,
      issue_date: form.issue_date || null,
      due_date: form.due_date || null,
      variable_symbol: form.variable_symbol || null,
      bank_account: form.bank_account || null,
      iban: form.iban || (form.bank_account ? bankAccountToIban(form.bank_account) : null),
      notes: form.notes || null,
    };
    saveMutation.mutate(values);
  };

  const handleEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setForm({
      invoice_type: inv.invoice_type,
      invoice_number: inv.invoice_number || "",
      supplier_id: inv.supplier_id || "",
      client_name: inv.client_name || "",
      client_ico: inv.client_ico || "",
      client_dic: inv.client_dic || "",
      client_address: inv.client_address || "",
      supplier_name: inv.supplier_name || "",
      supplier_ico: inv.supplier_ico || "",
      supplier_dic: inv.supplier_dic || "",
      supplier_address: inv.supplier_address || "",
      total_amount: inv.total_amount?.toString() || "",
      currency: inv.currency || "CZK",
      issue_date: inv.issue_date || "",
      due_date: inv.due_date || "",
      variable_symbol: inv.variable_symbol || "",
      bank_account: inv.bank_account || "",
      iban: inv.iban || "",
      notes: inv.notes || "",
    });
    setShowForm(true);
  };

  const handleDuplicate = (inv: Invoice) => {
    setEditingInvoice(null);
    setForm({
      invoice_type: inv.invoice_type,
      invoice_number: "",
      supplier_id: inv.supplier_id || "",
      client_name: inv.client_name || "",
      client_ico: inv.client_ico || "",
      client_dic: inv.client_dic || "",
      client_address: inv.client_address || "",
      supplier_name: inv.supplier_name || "",
      supplier_ico: inv.supplier_ico || "",
      supplier_dic: inv.supplier_dic || "",
      supplier_address: inv.supplier_address || "",
      total_amount: inv.total_amount?.toString() || "",
      currency: inv.currency || "CZK",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      variable_symbol: "",
      bank_account: inv.bank_account || DEFAULT_BANK_ACCOUNT,
      iban: inv.iban || "",
      notes: inv.notes || "",
    });
    setShowForm(true);
  };

  const handleShowQr = async (inv: Invoice) => {
    if (!inv.total_amount || inv.currency !== "CZK") {
      toast.error("QR kód lze generovat pouze pro CZK faktury s částkou");
      return;
    }
    const account = inv.bank_account || DEFAULT_BANK_ACCOUNT;
    const iban = inv.iban || bankAccountToIban(account);
    if (!iban) {
      toast.error("Chybí bankovní účet pro generování QR");
      return;
    }
    const spayd = generateSpaydString({
      iban,
      amount: inv.total_amount,
      variableSymbol: inv.variable_symbol || undefined,
      message: inv.invoice_number ? `Faktura ${inv.invoice_number}` : undefined,
    });
    const url = await QRCode.toDataURL(spayd, { width: 250, margin: 1, errorCorrectionLevel: "M" });
    setQrDataUrl(url);
    setQrDialogInvoice(inv);
  };

  const handleSupplierSelect = (supplierId: string) => {
    const s = suppliers.find((x) => x.id === supplierId);
    if (!s) return;
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      client_name: s.name,
      client_address: [s.street, s.city, s.postal_code, s.country_name].filter(Boolean).join(", "),
    }));
  };

  const filtered = invoices.filter((inv) => {
    if (inv.invoice_type !== tab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(s) ||
      inv.supplier_name?.toLowerCase().includes(s) ||
      inv.client_name?.toLowerCase().includes(s) ||
      inv.variable_symbol?.includes(s)
    );
  });

  const openNewForm = (type: string) => {
    setEditingInvoice(null);
    setForm({ ...emptyForm, invoice_type: type });
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fakturace</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="received">Přijaté faktury</TabsTrigger>
            <TabsTrigger value="issued">Vydané faktury</TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
          <Button onClick={() => openNewForm(tab)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nová faktura
          </Button>
        </div>

        <TabsContent value="received">
          <InvoiceTable
            invoices={filtered}
            isLoading={isLoading}
            type="received"
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onQr={handleShowQr}
            onDuplicate={handleDuplicate}
          />
        </TabsContent>
        <TabsContent value="issued">
          <InvoiceTable
            invoices={filtered}
            isLoading={isLoading}
            type="issued"
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onQr={handleShowQr}
            onDuplicate={handleDuplicate}
          />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingInvoice(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "Upravit fakturu" : "Nová faktura"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ faktury</Label>
                <Select value={form.invoice_type} onValueChange={(v) => setForm((f) => ({ ...f, invoice_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Přijatá</SelectItem>
                    <SelectItem value="issued">Vydaná</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Číslo faktury</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
              </div>
            </div>

            {form.invoice_type === "issued" && (
              <>
                <div className="border rounded-lg p-3 space-y-3">
                  <h3 className="text-sm font-semibold">Odběratel</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Vybrat z dodavatelů</Label>
                      <Select value={form.supplier_id} onValueChange={handleSupplierSelect}>
                        <SelectTrigger><SelectValue placeholder="Vybrat…" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nebo zadat IČO</Label>
                      <div className="flex gap-1">
                        <Input
                          value={form.client_ico}
                          onChange={(e) => setForm((f) => ({ ...f, client_ico: e.target.value }))}
                          placeholder="12345678"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleAresLookup(form.client_ico)}
                          disabled={aresLoading}
                        >
                          {aresLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Název</Label>
                      <Input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>DIČ</Label>
                      <Input value={form.client_dic} onChange={(e) => setForm((f) => ({ ...f, client_dic: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Adresa</Label>
                    <Input value={form.client_address} onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {form.invoice_type === "received" && (
              <div className="border rounded-lg p-3 space-y-3">
                <h3 className="text-sm font-semibold">Dodavatel</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>IČO dodavatele</Label>
                    <div className="flex gap-1">
                      <Input
                        value={form.supplier_ico}
                        onChange={(e) => setForm((f) => ({ ...f, supplier_ico: e.target.value }))}
                        placeholder="12345678"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => handleAresLookup(form.supplier_ico)} disabled={aresLoading}>
                        {aresLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Název dodavatele</Label>
                    <Input value={form.supplier_name} onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>DIČ</Label>
                    <Input value={form.supplier_dic} onChange={(e) => setForm((f) => ({ ...f, supplier_dic: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Adresa</Label>
                    <Input value={form.supplier_address} onChange={(e) => setForm((f) => ({ ...f, supplier_address: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Částka</Label>
                <Input type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
              </div>
              <div>
                <Label>Měna</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CZK">CZK</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Variabilní symbol</Label>
                <Input value={form.variable_symbol} onChange={(e) => setForm((f) => ({ ...f, variable_symbol: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum vystavení</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div>
                <Label>Datum splatnosti</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bankovní účet</Label>
                <Input value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} placeholder="123456789/0100" />
              </div>
              <div>
                <Label>IBAN</Label>
                <Input value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} placeholder="CZ..." />
              </div>
            </div>

            <div>
              <Label>Poznámky</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingInvoice(null); }}>Zrušit</Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingInvoice ? "Uložit" : "Vytvořit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={!!qrDialogInvoice} onOpenChange={(o) => { if (!o) setQrDialogInvoice(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR platba</DialogTitle>
          </DialogHeader>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3">
              <img src={qrDataUrl} alt="QR platba" className="w-[250px] h-[250px]" />
              <p className="text-sm text-muted-foreground text-center">
                {qrDialogInvoice?.total_amount?.toLocaleString("cs-CZ")} {qrDialogInvoice?.currency}
                {qrDialogInvoice?.variable_symbol && ` • VS: ${qrDialogInvoice.variable_symbol}`}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceTable({
  invoices,
  isLoading,
  type,
  onEdit,
  onDelete,
  onQr,
  onDuplicate,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  type: string;
  onEdit: (i: Invoice) => void;
  onDelete: (id: string) => void;
  onQr: (i: Invoice) => void;
  onDuplicate: (i: Invoice) => void;
}) {
  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Načítání…</div>;
  }
  if (!invoices.length) {
    return <div className="py-8 text-center text-muted-foreground">Žádné faktury</div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Číslo</TableHead>
              <TableHead>{type === "issued" ? "Odběratel" : "Dodavatel"}</TableHead>
              <TableHead className="text-right">Částka</TableHead>
              <TableHead>Vystaveno</TableHead>
              <TableHead>Splatnost</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_number || "—"}</TableCell>
                <TableCell>
                  {type === "issued" ? inv.client_name : inv.supplier_name}
                  {inv.deal_id && (
                    <Badge variant="outline" className="ml-1 text-[10px]">OP</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {inv.total_amount?.toLocaleString("cs-CZ")} {inv.currency}
                </TableCell>
                <TableCell>
                  {inv.issue_date ? format(new Date(inv.issue_date), "d.M.yyyy") : "—"}
                </TableCell>
                <TableCell>
                  {inv.due_date ? format(new Date(inv.due_date), "d.M.yyyy") : "—"}
                </TableCell>
                <TableCell>
                  {inv.paid ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                      Zaplaceno{inv.paid_at ? ` ${format(new Date(inv.paid_at), "d.M.")}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">Nezaplaceno</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {inv.currency === "CZK" && inv.total_amount && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onQr(inv)} title="QR platba">
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {inv.file_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Otevřít soubor">
                        <a href={inv.file_url} target="_blank" rel="noopener"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    {type === "issued" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(inv)} title="Duplikovat">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(inv)} title="Upravit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!inv.deal_supplier_invoice_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(inv.id)} title="Smazat">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
