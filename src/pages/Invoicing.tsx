import { useState, useEffect, useRef } from "react";
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
import { Plus, Search, Copy, QrCode, ExternalLink, Pencil, Trash2, Loader2, FileText, Send, ScanLine, Check, X, CheckCircle2 } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { generatePaymentQrDataUrl, bankAccountToIban, generateSpaydString } from "@/lib/spayd";
import QRCode from "qrcode";

const DEFAULT_BANK_ACCOUNT = "227993932/0600";
const AGENCY_PARTNER_NAME = "YARO s.r.o.";

type InvoiceItem = {
  text: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

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
  items: InvoiceItem[] | null;
  created_at: string;
};

const emptyItem: InvoiceItem = { text: "", quantity: 1, unit_price: 0, vat_rate: 21 };

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
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [pdfQrUrl, setPdfQrUrl] = useState<string | null>(null);
  const [emailDialog, setEmailDialog] = useState<Invoice | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<{ supplier_name?: string; total_amount?: number; currency?: string; issue_date?: string } | null>(null);
  const [scanFileUrl, setScanFileUrl] = useState<string | null>(null);
  const [scanFileName, setScanFileName] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([{ ...emptyItem }]);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [markPaidMethod, setMarkPaidMethod] = useState<string>("moneta");
  const queryClient = useQueryClient();
  const pdfRef = useRef<HTMLDivElement>(null);
  const ocrFileRef = useRef<HTMLInputElement>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Invoice[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, email, address, street, city, postal_code, country_name, ico, dic, partner_type").order("name");
      return data || [];
    },
  });

  // Find agency partner (YARO s.r.o.) for issued invoice defaults
  const agencyPartner = suppliers.find((s) => s.name === AGENCY_PARTNER_NAME);
  const agencyName = agencyPartner?.name || AGENCY_PARTNER_NAME;
  const agencyIco = agencyPartner?.ico || "";
  const agencyDic = agencyPartner?.dic || "";
  const agencyAddress = agencyPartner
    ? [agencyPartner.street, agencyPartner.postal_code, agencyPartner.city, agencyPartner.country_name].filter(Boolean).join(", ")
    : "";

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
      setOcrPreview(null);
      setScanFileUrl(null);
      setScanFileName(null);
      setItems([{ ...emptyItem }]);
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

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoice, paid_at, payment_method }: { invoice: Invoice; paid_at: string; payment_method: string }) => {
      const { error } = await supabase.from("invoices").update({ paid: true, paid_at, payment_method }).eq("id", invoice.id);
      if (error) throw error;
      if (invoice.deal_supplier_invoice_id) {
        await supabase.from("deal_supplier_invoices").update({ is_paid: true, paid_at, payment_method }).eq("id", invoice.deal_supplier_invoice_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["deal-supplier-invoices"] });
      toast.success("Faktura označena jako zaplacená");
      setMarkPaidInvoice(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleOpenMarkPaid = (inv: Invoice) => {
    setMarkPaidDate(format(new Date(), "yyyy-MM-dd"));
    setMarkPaidMethod(inv.payment_method || "moneta");
    setMarkPaidInvoice(inv);
  };

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

  const handleOcrScan = async (file: File) => {
    setOcrScanning(true);
    setOcrPreview(null);
    try {
      let processFile = file;
      if (file.type.startsWith("image/") && file.type !== "image/png") {
        const compressed = await compressImage(file);
        processFile = new File([compressed.blob], file.name, { type: compressed.blob.type });
      }
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(processFile);
      });

      // Upload file to storage
      const ext = file.name.split(".").pop() || "png";
      const path = `invoices/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, processFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        setScanFileUrl(urlData?.publicUrl || null);
        setScanFileName(file.name);
      }

      const { data, error } = await supabase.functions.invoke("ocr-supplier-invoice", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.data) {
        setOcrPreview(data.data);
        toast.success("Data extrahována – zkontrolujte a potvrďte");
      } else {
        toast.error("Nepodařilo se rozpoznat data z dokumentu");
      }
    } catch (err: any) {
      toast.error(err.message || "Chyba při OCR skenování");
    } finally {
      setOcrScanning(false);
    }
  };

  const handleOcrConfirm = () => {
    if (!ocrPreview) return;
    setForm((f) => ({
      ...f,
      supplier_name: ocrPreview.supplier_name || f.supplier_name,
      total_amount: ocrPreview.total_amount?.toString() || f.total_amount,
      currency: ocrPreview.currency || f.currency,
      issue_date: ocrPreview.issue_date
        ? ocrPreview.issue_date.split(".").length === 3
          ? `${ocrPreview.issue_date.split(".")[2]}-${ocrPreview.issue_date.split(".")[1].padStart(2, "0")}-${ocrPreview.issue_date.split(".")[0].padStart(2, "0")}`
          : f.issue_date
        : f.issue_date,
    }));
    setOcrPreview(null);
    toast.success("Data převzata do formuláře");
  };

  const handleSubmit = () => {
    // Auto-calculate total from items for issued invoices
    const calcItems = form.invoice_type === "issued" && items.length > 0 ? items : [];
    const itemsTotal = calcItems.reduce((sum, it) => sum + it.quantity * it.unit_price * (1 + it.vat_rate / 100), 0);
    const finalTotal = calcItems.length > 0 && calcItems.some(it => it.text || it.unit_price > 0) 
      ? Math.round(itemsTotal * 100) / 100 
      : (form.total_amount ? parseFloat(form.total_amount) : null);

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
      total_amount: finalTotal,
      currency: form.currency,
      issue_date: form.issue_date || null,
      due_date: form.due_date || null,
      variable_symbol: form.variable_symbol || null,
      bank_account: form.bank_account || null,
      iban: form.iban || (form.bank_account ? bankAccountToIban(form.bank_account) : null),
      file_url: scanFileUrl || editingInvoice?.file_url || null,
      file_name: scanFileName || editingInvoice?.file_name || null,
      notes: form.notes || null,
      items: calcItems.length > 0 ? calcItems : [],
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
    setItems(Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [{ ...emptyItem }]);
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
    setItems(Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [{ ...emptyItem }]);
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
      client_ico: (s as any).ico || f.client_ico,
      client_dic: (s as any).dic || f.client_dic,
      client_address: [s.street, s.city, s.postal_code, s.country_name].filter(Boolean).join(", "),
    }));
  };

  const handleGeneratePdf = async (inv: Invoice) => {
    if (inv.currency === "CZK" && inv.total_amount) {
      const account = inv.bank_account || DEFAULT_BANK_ACCOUNT;
      const iban = inv.iban || bankAccountToIban(account);
      if (iban) {
        const spayd = generateSpaydString({
          iban,
          amount: inv.total_amount,
          variableSymbol: inv.variable_symbol || undefined,
          message: inv.notes || (inv.invoice_number ? `Faktura ${inv.invoice_number}` : undefined),
        });
        const url = await QRCode.toDataURL(spayd, { width: 180, margin: 1, errorCorrectionLevel: "M" });
        setPdfQrUrl(url);
      } else {
        setPdfQrUrl(null);
      }
    } else {
      setPdfQrUrl(null);
    }
    setPdfInvoice(inv);
  };

  const handlePrintPdf = async () => {
    if (!pdfRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const el = pdfRef.current;
    html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${pdfInvoice?.invoice_number || "faktura"}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(el)
      .save();
  };

  const handleOpenEmailDialog = (inv: Invoice) => {
    // Try to find the supplier to get their email
    const supplier = suppliers.find((s) => s.id === inv.supplier_id);
    setEmailTo(supplier?.email || "");
    setEmailSubject(`Faktura ${inv.invoice_number || ""}`);
    setEmailBody(buildDefaultEmailBody(inv));
    setEmailDialog(inv);
  };

  const handleSendEmail = async () => {
    if (!emailDialog || !emailTo) {
      toast.error("Vyplňte e-mailovou adresu příjemce");
      return;
    }
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoiceId: emailDialog.id,
          recipientEmail: emailTo,
          customSubject: emailSubject,
          customBody: emailBody,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Faktura odeslána e-mailem");
      setEmailDialog(null);
    } catch (err: any) {
      toast.error(err.message || "Nepodařilo se odeslat e-mail");
    } finally {
      setEmailSending(false);
    }
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
    const base = { ...emptyForm, invoice_type: type };
    if (type === "issued") {
      base.supplier_name = agencyName;
      base.supplier_ico = agencyIco;
      base.supplier_dic = agencyDic;
      base.supplier_address = agencyAddress;
    }
    setForm(base);
    setOcrPreview(null);
    setScanFileUrl(null);
    setScanFileName(null);
    setItems([{ ...emptyItem }]);
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
            onPdf={handleGeneratePdf}
            onEmail={handleOpenEmailDialog}
            onMarkPaid={handleOpenMarkPaid}
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
            onPdf={handleGeneratePdf}
            onEmail={handleOpenEmailDialog}
            onMarkPaid={handleOpenMarkPaid}
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
                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  placeholder={form.invoice_type === "issued" && !editingInvoice ? "Automaticky (FAV-RRNNN)" : ""}
                  disabled={form.invoice_type === "issued" && !editingInvoice}
                />
                {form.invoice_type === "issued" && !editingInvoice && (
                  <p className="text-xs text-muted-foreground mt-1">Číslo bude přiděleno automaticky</p>
                )}
              </div>
            </div>

            {form.invoice_type === "issued" && (
              <>
                <div className="border rounded-lg p-3 space-y-3">
                  <h3 className="text-sm font-semibold">Odběratel</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Vybrat z partnerů</Label>
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
              <div className="space-y-3">
                {/* OCR Scan */}
                <div className="border border-dashed rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <ScanLine className="h-4 w-4" /> Skenování faktury (OCR)
                    </h3>
                    <div>
                      <input
                        ref={ocrFileRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleOcrScan(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => ocrFileRef.current?.click()}
                        disabled={ocrScanning}
                      >
                        {ocrScanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ScanLine className="h-4 w-4 mr-1" />}
                        {ocrScanning ? "Skenování…" : "Nahrát a skenovat"}
                      </Button>
                    </div>
                  </div>

                  {/* OCR Preview */}
                  {ocrPreview && (
                    <div className="bg-green-500/10 rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">Extrahovaná data — zkontrolujte a potvrďte:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {ocrPreview.supplier_name && (
                          <div><span className="text-muted-foreground">Dodavatel:</span> {ocrPreview.supplier_name}</div>
                        )}
                        {ocrPreview.total_amount != null && (
                          <div><span className="text-muted-foreground">Částka:</span> {ocrPreview.total_amount.toLocaleString("cs-CZ")} {ocrPreview.currency || "CZK"}</div>
                        )}
                        {ocrPreview.issue_date && (
                          <div><span className="text-muted-foreground">Datum vystavení:</span> {ocrPreview.issue_date}</div>
                        )}
                        {ocrPreview.currency && (
                          <div><span className="text-muted-foreground">Měna:</span> {ocrPreview.currency}</div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" onClick={handleOcrConfirm}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Převzít data
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setOcrPreview(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Zahodit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Supplier info */}
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
              </div>
            )}

            {/* Line items for issued invoices */}
            {form.invoice_type === "issued" && (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Položky faktury</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Přidat řádek
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_70px_100px_70px_70px_32px] gap-1.5 text-xs text-muted-foreground font-medium px-1">
                    <span>Popis</span>
                    <span>Množství</span>
                    <span>Cena/ks</span>
                    <span>DPH %</span>
                    <span>Celkem</span>
                    <span></span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_70px_100px_70px_70px_32px] gap-1.5 items-center">
                      <Input
                        value={item.text}
                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, text: e.target.value } : it))}
                        placeholder="Popis položky"
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                        className="h-8 text-sm"
                        min={0}
                      />
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                        className="h-8 text-sm"
                        min={0}
                      />
                      <Input
                        type="number"
                        value={item.vat_rate}
                        onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, vat_rate: parseFloat(e.target.value) || 0 } : it))}
                        className="h-8 text-sm"
                        min={0}
                      />
                      <span className="text-sm tabular-nums text-right pr-1">
                        {(item.quantity * item.unit_price).toLocaleString("cs-CZ")}
                      </span>
                      <div className="flex gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setItems((prev) => [...prev.slice(0, idx + 1), { ...prev[idx] }, ...prev.slice(idx + 1)])}
                          title="Duplikovat"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            title="Odebrat"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                {items.some((it) => it.text || it.unit_price > 0) && (() => {
                  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
                  const vatTotal = items.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
                  return (
                    <div className="border-t pt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Základ:</span>
                        <span className="tabular-nums">{subtotal.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {form.currency}</span>
                      </div>
                      {vatTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">DPH:</span>
                          <span className="tabular-nums">{vatTotal.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {form.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>Celkem:</span>
                        <span className="tabular-nums">{(subtotal + vatTotal).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {form.currency}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {form.invoice_type !== "issued" && (
              <div>
                <Label>Částka</Label>
                <Input type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
              </div>
              )}
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
                <Input
                  value={form.variable_symbol}
                  onChange={(e) => setForm((f) => ({ ...f, variable_symbol: e.target.value }))}
                  placeholder={form.invoice_type === "issued" && !editingInvoice ? "Automaticky z čísla" : ""}
                  disabled={form.invoice_type === "issued" && !editingInvoice}
                />
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

      {/* Mark as Paid Dialog */}
      <Dialog open={!!markPaidInvoice} onOpenChange={(o) => { if (!o) setMarkPaidInvoice(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Označit jako zaplacenou</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {markPaidInvoice?.invoice_number || markPaidInvoice?.supplier_name || "Faktura"} — {markPaidInvoice?.total_amount?.toLocaleString("cs-CZ")} {markPaidInvoice?.currency}
            </p>
            <div>
              <Label>Datum zaplacení</Label>
              <Input type="date" value={markPaidDate} onChange={(e) => setMarkPaidDate(e.target.value)} />
            </div>
            <div>
              <Label>Způsob platby</Label>
              <Select value={markPaidMethod} onValueChange={setMarkPaidMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moneta">Moneta</SelectItem>
                  <SelectItem value="amnis">Amnis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMarkPaidInvoice(null)}>Zrušit</Button>
              <Button onClick={() => markPaidInvoice && markPaidMutation.mutate({ invoice: markPaidInvoice, paid_at: markPaidDate, payment_method: markPaidMethod })} disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Potvrdit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!pdfInvoice} onOpenChange={(o) => { if (!o) setPdfInvoice(null); }}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Náhled faktury</span>
              <Button onClick={handlePrintPdf} size="sm">
                <FileText className="h-4 w-4 mr-1" /> Stáhnout PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          {pdfInvoice && (
            <div ref={pdfRef} className="bg-white text-black p-8" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", lineHeight: "1.5" }}>
              <InvoicePdfContent invoice={pdfInvoice} qrUrl={pdfQrUrl} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={!!emailDialog} onOpenChange={(o) => { if (!o) setEmailDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Odeslat fakturu e-mailem</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Příjemce</Label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="email@firma.cz" />
            </div>
            <div>
              <Label>Předmět</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label>Text e-mailu</Label>
              <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailDialog(null)}>Zrušit</Button>
              <Button onClick={handleSendEmail} disabled={emailSending}>
                {emailSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Odeslat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoicePdfContent({ invoice, qrUrl }: { invoice: Invoice; qrUrl: string | null }) {
  const formatDate = (d: string | null) => d ? format(new Date(d), "d.M.yyyy") : "—";
  const formatAmount = (a: number | null, c: string | null) =>
    a != null ? `${a.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} ${c || "CZK"}` : "—";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px", color: "#000" }}>
            FAKTURA {invoice.invoice_number || ""}
          </h1>
          <p style={{ color: "#666", margin: 0, fontSize: "11px" }}>
            {invoice.invoice_type === "issued" ? "Vydaná faktura" : "Přijatá faktura"}
          </p>
        </div>
      </div>

      {/* Two column: Supplier / Customer */}
      <div style={{ display: "flex", gap: "40px", marginBottom: "25px" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>
            Dodavatel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px" }}>{invoice.supplier_name || ""}</p>
          <p style={{ margin: "0 0 2px", fontSize: "11px" }}>{invoice.supplier_address || ""}</p>
          {invoice.supplier_ico && <p style={{ margin: "0 0 2px", fontSize: "11px" }}>IČO: {invoice.supplier_ico}</p>}
          {invoice.supplier_dic && <p style={{ margin: 0, fontSize: "11px" }}>DIČ: {invoice.supplier_dic}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>
            Odběratel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px" }}>{invoice.client_name || "—"}</p>
          <p style={{ margin: "0 0 2px", fontSize: "11px" }}>{invoice.client_address || ""}</p>
          {invoice.client_ico && <p style={{ margin: "0 0 2px", fontSize: "11px" }}>IČO: {invoice.client_ico}</p>}
          {invoice.client_dic && <p style={{ margin: 0, fontSize: "11px" }}>DIČ: {invoice.client_dic}</p>}
        </div>
      </div>

      {/* Invoice details */}
      <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #ddd", padding: "12px 0", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "30px" }}>
          <div>
            <span style={{ fontSize: "10px", color: "#888" }}>Datum vystavení</span>
            <p style={{ margin: 0, fontWeight: "bold" }}>{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#888" }}>Datum splatnosti</span>
            <p style={{ margin: 0, fontWeight: "bold" }}>{formatDate(invoice.due_date)}</p>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#888" }}>Variabilní symbol</span>
            <p style={{ margin: 0, fontWeight: "bold" }}>{invoice.variable_symbol || "—"}</p>
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "#888" }}>Bankovní účet</span>
            <p style={{ margin: 0, fontWeight: "bold" }}>{invoice.bank_account || DEFAULT_BANK_ACCOUNT}</p>
          </div>
        </div>
      </div>

      {/* Items table */}
      {Array.isArray(invoice.items) && invoice.items.length > 0 && invoice.items.some((it: any) => it.text || it.unit_price > 0) && (() => {
        const typedItems = invoice.items as InvoiceItem[];
        const subtotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);
        const vatTotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
        return (
          <div style={{ marginBottom: "25px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: "bold" }}>Popis</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", width: "60px" }}>Množství</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", width: "90px" }}>Cena/ks</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", width: "60px" }}>DPH</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", width: "90px" }}>Celkem</th>
                </tr>
              </thead>
              <tbody>
                {typedItems.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "5px 4px" }}>{it.text}</td>
                    <td style={{ textAlign: "right", padding: "5px 4px" }}>{it.quantity}</td>
                    <td style={{ textAlign: "right", padding: "5px 4px" }}>{it.unit_price.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right", padding: "5px 4px" }}>{it.vat_rate}%</td>
                    <td style={{ textAlign: "right", padding: "5px 4px" }}>{(it.quantity * it.unit_price).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid #ccc" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "5px 4px", fontWeight: "bold" }}>Základ:</td>
                  <td style={{ textAlign: "right", padding: "5px 4px", fontWeight: "bold" }}>{subtotal.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {invoice.currency || "CZK"}</td>
                </tr>
                {vatTotal > 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", padding: "3px 4px" }}>DPH:</td>
                    <td style={{ textAlign: "right", padding: "3px 4px" }}>{vatTotal.toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {invoice.currency || "CZK"}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #000" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", fontSize: "13px" }}>Celkem k úhradě:</td>
                  <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: "bold", fontSize: "13px" }}>{(subtotal + vatTotal).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} {invoice.currency || "CZK"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Amount (shown when no items) */}
      {(!Array.isArray(invoice.items) || !invoice.items.length || !invoice.items.some((it: any) => it.text || it.unit_price > 0)) && (
      <div style={{ background: "#f8f8f8", borderRadius: "6px", padding: "16px 20px", marginBottom: "25px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "14px", fontWeight: "bold" }}>Celkem k úhradě</span>
        <span style={{ fontSize: "20px", fontWeight: "bold" }}>{formatAmount(invoice.total_amount, invoice.currency)}</span>
      </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div style={{ marginBottom: "25px" }}>
          <h3 style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Poznámka</h3>
          <p style={{ margin: 0, fontSize: "11px" }}>{invoice.notes}</p>
        </div>
      )}

      {/* QR Code */}
      {qrUrl && (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "15px", display: "flex", alignItems: "center", gap: "15px" }}>
          <img src={qrUrl} alt="QR platba" style={{ width: "140px", height: "140px" }} />
          <div>
            <p style={{ fontWeight: "bold", margin: "0 0 4px", fontSize: "11px" }}>QR platba</p>
            <p style={{ margin: "0 0 2px", fontSize: "10px", color: "#666" }}>Naskenujte kód pro rychlou úhradu</p>
            <p style={{ margin: "0 0 2px", fontSize: "10px", color: "#666" }}>Částka: {formatAmount(invoice.total_amount, invoice.currency)}</p>
            {invoice.variable_symbol && <p style={{ margin: "0 0 2px", fontSize: "10px", color: "#666" }}>VS: {invoice.variable_symbol}</p>}
            {invoice.due_date && <p style={{ margin: 0, fontSize: "10px", color: "#666" }}>Splatnost: {formatDate(invoice.due_date)}</p>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "30px", borderTop: "1px solid #ddd", paddingTop: "10px", textAlign: "center", color: "#999", fontSize: "9px" }}>
        {invoice.supplier_name || ""} • {invoice.supplier_address || ""}{invoice.supplier_ico ? ` • IČO: ${invoice.supplier_ico}` : ""}{invoice.supplier_dic ? ` • DIČ: ${invoice.supplier_dic}` : ""}
      </div>
    </div>
  );
}

function buildDefaultEmailBody(inv: Invoice): string {
  const amount = inv.total_amount
    ? `${inv.total_amount.toLocaleString("cs-CZ")} ${inv.currency || "CZK"}`
    : "";
  const dueDate = inv.due_date ? format(new Date(inv.due_date), "d.M.yyyy") : "";
  const vs = inv.variable_symbol || "";

  return `Dobrý den,

zasíláme Vám fakturu č. ${inv.invoice_number || ""}.

Částka: ${amount}${vs ? `\nVariabilní symbol: ${vs}` : ""}${dueDate ? `\nDatum splatnosti: ${dueDate}` : ""}
Bankovní účet: ${inv.bank_account || DEFAULT_BANK_ACCOUNT}

S pozdravem,
YARO Travel
Tel.: +420 602 102 108
www.yarotravel.cz
zajezdy@yarotravel.cz`;
}

function InvoiceTable({
  invoices,
  isLoading,
  type,
  onEdit,
  onDelete,
  onQr,
  onDuplicate,
  onPdf,
  onEmail,
  onMarkPaid,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  type: string;
  onEdit: (i: Invoice) => void;
  onDelete: (id: string) => void;
  onQr: (i: Invoice) => void;
  onDuplicate: (i: Invoice) => void;
  onPdf: (i: Invoice) => void;
  onEmail: (i: Invoice) => void;
  onMarkPaid: (i: Invoice) => void;
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
              <TableHead>VS</TableHead>
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
                <TableCell className="tabular-nums text-xs">{inv.variable_symbol || "—"}</TableCell>
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
                    {!inv.paid && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => onMarkPaid(inv)} title="Označit jako zaplacenou">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {type === "issued" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPdf(inv)} title="Náhled PDF">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {type === "issued" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEmail(inv)} title="Odeslat e-mailem">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
