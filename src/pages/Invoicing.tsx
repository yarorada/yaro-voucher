import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
import { Plus, Search, Copy, QrCode, ExternalLink, Pencil, Trash2, Loader2, FileText, Send, ScanLine, Check, X, CheckCircle2, MoreHorizontal, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { generatePaymentQrDataUrl, bankAccountToIban, generateSpaydString } from "@/lib/spayd";
import QRCode from "qrcode";

function InvoiceDatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const dateValue = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <div>
      {label && <Label>{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue ? format(dateValue, "d.M.yyyy") : "Vyberte datum"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
  specific_symbol: string | null;
  constant_symbol: string | null;
  bank_account: string | null;
  iban: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  payment_method: string | null;
  items: InvoiceItem[] | null;
  created_at: string;
  taxable_date?: string | null;
};

type FilePreviewKind = "image" | "pdf" | "other";

function getFilePreviewKind(fileName?: string | null, fileUrl?: string | null): FilePreviewKind {
  const candidate = `${fileName || ""} ${fileUrl || ""}`.toLowerCase();
  if (/\.(jpe?g|png|webp|gif|bmp|heic|heif|svg)(\?|$)/i.test(candidate)) return "image";
  if (/\.pdf(\?|$)/i.test(candidate)) return "pdf";
  return "other";
}

function parseStorageReference(fileUrl: string): { bucket: string; path: string } | null {
  try {
    const { pathname } = new URL(fileUrl);
    const markers = ["/storage/v1/object/public/", "/storage/v1/object/sign/"];
    const marker = markers.find((item) => pathname.includes(item));
    if (!marker) return null;

    const storageLocation = pathname.split(marker)[1];
    if (!storageLocation) return null;

    const [bucket, ...pathParts] = storageLocation.split("/");
    if (!bucket || pathParts.length === 0) return null;

    return {
      bucket,
      path: decodeURIComponent(pathParts.join("/")),
    };
  } catch {
    return null;
  }
}

function base64ToBlobUrl(base64: string, contentType: string) {
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([byteArr], { type: contentType || "application/octet-stream" }));
}

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
  taxable_date: format(new Date(), "yyyy-MM-dd"),
  due_date: "",
  variable_symbol: "",
  specific_symbol: "",
  constant_symbol: "",
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
  const [filePreviewInvoice, setFilePreviewInvoice] = useState<Invoice | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [filePreviewKind, setFilePreviewKind] = useState<FilePreviewKind>("other");
  const queryClient = useQueryClient();
  const pdfRef = useRef<HTMLDivElement>(null);
  const ocrFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (filePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

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
      taxable_date: form.taxable_date || null,
      specific_symbol: form.specific_symbol || null,
      constant_symbol: form.constant_symbol || null,
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
      taxable_date: (inv as any).taxable_date || "",
      specific_symbol: inv.specific_symbol || "",
      constant_symbol: inv.constant_symbol || "",
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
      taxable_date: format(new Date(), "yyyy-MM-dd"),
      specific_symbol: inv.specific_symbol || "",
      constant_symbol: inv.constant_symbol || "",
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

  const getInvoiceTotal = (inv: Invoice): number | null => {
    if (Array.isArray(inv.items) && inv.items.length > 0 && inv.items.some((it: any) => it.text || it.unit_price > 0)) {
      const typedItems = inv.items as InvoiceItem[];
      return Math.round(typedItems.reduce((s, it) => s + it.quantity * it.unit_price * (1 + it.vat_rate / 100), 0) * 100) / 100;
    }
    return inv.total_amount;
  };

  const clearFilePreviewUrl = () => {
    setFilePreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  };

  const closeFilePreview = () => {
    clearFilePreviewUrl();
    setFilePreviewInvoice(null);
    setFilePreviewLoading(false);
    setFilePreviewKind("other");
  };

  const renderPdfPreviewHtmlUrl = async (blob: Blob) => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const pdfBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const pageImages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        continue;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      pageImages.push(canvas.toDataURL("image/png"));
    }

    if (!pageImages.length) {
      throw new Error("PDF preview render failed");
    }

    const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Náhled faktury</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        background: #f5f5f5;
        font-family: Arial, sans-serif;
      }
      .pages {
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: center;
      }
      .page {
        width: 100%;
        max-width: 1100px;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }
      img {
        display: block;
        width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="pages">
      ${pageImages.map((src, index) => `<figure class="page"><img src="${src}" alt="Strana ${index + 1}" /></figure>`).join("")}
    </div>
  </body>
</html>`;

    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  };

  const downloadInvoiceFileBlob = async (fileUrl: string) => {
    const storageReference = parseStorageReference(fileUrl);

    if (storageReference) {
      try {
        const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-file", {
          body: storageReference,
        });

        if (!proxyError && proxyData?.base64) {
          const byteChars = atob(proxyData.base64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArr[i] = byteChars.charCodeAt(i);
          }
          return new Blob([byteArr], { type: proxyData.contentType || "application/octet-stream" });
        }
      } catch (error) {
        console.warn("Proxy preview failed:", error);
      }

      try {
        const { data, error } = await supabase.storage.from(storageReference.bucket).download(storageReference.path);
        if (!error && data) {
          return data;
        }
      } catch (error) {
        console.warn("Storage preview failed:", error);
      }

      try {
        const { data, error } = await supabase.storage.from(storageReference.bucket).createSignedUrl(storageReference.path, 300);
        if (!error && data?.signedUrl) {
          const response = await fetch(data.signedUrl);
          if (response.ok) {
            return await response.blob();
          }
        }
      } catch (error) {
        console.warn("Signed URL preview failed:", error);
      }
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error("Preview download failed");
    }

    return await response.blob();
  };

  const getInvoiceFilePreviewUrl = async (fileUrl: string, fileName?: string | null) => {
    const fileBlob = await downloadInvoiceFileBlob(fileUrl);

    if (getFilePreviewKind(fileName, fileUrl) === "pdf") {
      try {
        return await renderPdfPreviewHtmlUrl(fileBlob);
      } catch (error) {
        console.warn("PDF preview render failed, falling back to blob preview:", error);
      }
    }

    return URL.createObjectURL(fileBlob);
  };

  const resolveInvoiceFile = async (inv: Invoice) => {
    if (inv.file_url) {
      return {
        fileUrl: inv.file_url,
        fileName: inv.file_name,
      };
    }

    if (inv.deal_supplier_invoice_id) {
      const { data, error } = await supabase
        .from("deal_supplier_invoices")
        .select("file_url, file_name")
        .eq("id", inv.deal_supplier_invoice_id)
        .maybeSingle();

      if (!error && data?.file_url) {
        return {
          fileUrl: data.file_url,
          fileName: data.file_name,
        };
      }
    }

    return null;
  };

  const openReceivedInvoicePreview = async (inv: Invoice) => {
    const resolvedFile = await resolveInvoiceFile(inv);

    if (!resolvedFile?.fileUrl) {
      toast.error("U faktury chybí nahraný soubor");
      return;
    }

    clearFilePreviewUrl();
    setFilePreviewInvoice(inv);
    setFilePreviewKind(getFilePreviewKind(resolvedFile.fileName, resolvedFile.fileUrl));
    setFilePreviewLoading(true);

    try {
      const previewUrl = await getInvoiceFilePreviewUrl(resolvedFile.fileUrl, resolvedFile.fileName);
      setFilePreviewUrl(previewUrl);
    } catch (error) {
      console.error("Invoice preview failed:", error);
      closeFilePreview();
      toast.error("Nepodařilo se načíst soubor faktury");
    } finally {
      setFilePreviewLoading(false);
    }
  };

  const handleOpenInvoiceFile = async (inv: Invoice) => {
    if (inv.invoice_type === "received") {
      await openReceivedInvoicePreview(inv);
      return;
    }

    if (!inv.file_url) return;

    try {
      const fileBlob = await downloadInvoiceFileBlob(inv.file_url);
      const fileBlobUrl = URL.createObjectURL(fileBlob);
      window.open(fileBlobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(fileBlobUrl), 60_000);
    } catch (error) {
      console.error("Invoice file open failed:", error);
      toast.error("Nepodařilo se otevřít soubor faktury");
    }
  };

  const handleGeneratePdf = async (inv: Invoice) => {
    if (inv.invoice_type === "received" && (inv.file_url || inv.deal_supplier_invoice_id)) {
      await openReceivedInvoicePreview(inv);
      return;
    }

    const effectiveTotal = getInvoiceTotal(inv);
    if (inv.currency === "CZK" && effectiveTotal) {
      const account = inv.bank_account || DEFAULT_BANK_ACCOUNT;
      const iban = inv.iban || bankAccountToIban(account);
      if (iban) {
        const spayd = generateSpaydString({
          iban,
          amount: effectiveTotal,
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

  const filePreviewPortal = filePreviewInvoice ? createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/80"
      onClick={closeFilePreview}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Náhled faktury</h2>
            <p className="text-sm text-muted-foreground">
              {filePreviewInvoice.file_name || filePreviewInvoice.invoice_number || "Doklad"}
            </p>
          </div>
          <button
            onClick={closeFilePreview}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Zavřít</span>
          </button>
        </div>

        <div className="flex min-h-[60vh] items-center justify-center">
          {filePreviewLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : filePreviewUrl && filePreviewKind === "image" ? (
            <img
              src={filePreviewUrl}
              alt={filePreviewInvoice.file_name || "Faktura"}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
          ) : filePreviewUrl && filePreviewKind === "pdf" ? (
            <iframe
              src={filePreviewUrl}
              className="h-[75vh] w-full rounded-lg"
              title={filePreviewInvoice.file_name || "Náhled faktury"}
            />
          ) : filePreviewUrl ? (
            <div className="space-y-3 py-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Náhled není pro tento typ souboru dostupný.</p>
              <Button onClick={() => window.open(filePreviewUrl, "_blank", "noopener,noreferrer")}>Otevřít soubor</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Náhled souboru není dostupný.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

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
            onOpenFile={handleOpenInvoiceFile}
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
            onOpenFile={handleOpenInvoiceFile}
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

            {/* === DATUMY === */}
            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold">Datumy</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Datum vystavení</Label>
                  <Input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
                </div>
                {form.invoice_type === "issued" && (
                  <div>
                    <Label>DUZP</Label>
                    <Input type="date" value={form.taxable_date} onChange={(e) => setForm((f) => ({ ...f, taxable_date: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label>Datum splatnosti</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* === SYMBOLY === */}
            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold">Symboly</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Variabilní symbol</Label>
                  <Input
                    value={form.variable_symbol}
                    onChange={(e) => setForm((f) => ({ ...f, variable_symbol: e.target.value }))}
                    placeholder={form.invoice_type === "issued" && !editingInvoice ? "Automaticky z čísla" : ""}
                    disabled={form.invoice_type === "issued" && !editingInvoice}
                  />
                </div>
                <div>
                  <Label>Specifický symbol</Label>
                  <Input value={form.specific_symbol} onChange={(e) => setForm((f) => ({ ...f, specific_symbol: e.target.value }))} />
                </div>
                <div>
                  <Label>Konstantní symbol</Label>
                  <Input value={form.constant_symbol} onChange={(e) => setForm((f) => ({ ...f, constant_symbol: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* === PLATEBNÍ ÚDAJE === */}
            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold">Platební údaje</h3>
              <div className="grid grid-cols-3 gap-3">
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
                  <Label>Bankovní účet</Label>
                  <Input value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} placeholder="123456789/0100" />
                </div>
                <div>
                  <Label>IBAN</Label>
                  <Input value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} placeholder="CZ..." />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {form.invoice_type !== "issued" && (
              <div>
                <Label>Částka</Label>
                <Input type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
              </div>
              )}
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

      {filePreviewPortal}

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
  const cur = invoice.currency || "CZK";
  const curSymbol = cur === "CZK" ? "Kč" : cur === "EUR" ? "€" : cur === "USD" ? "$" : cur === "GBP" ? "£" : cur;
  const fmt = (n: number) => n.toLocaleString("cs-CZ", { minimumFractionDigits: 2 });
  const fmtCur = (n: number) => <span style={{ whiteSpace: "nowrap" }}>{fmt(n)}&nbsp;{curSymbol}</span>;
  const formatAmount = (a: number | null) => a != null ? fmtCur(a) : "—";
  const taxableDate = invoice.taxable_date || invoice.issue_date;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px", color: "#000" }}>
          FAKTURA {invoice.invoice_number || ""}
        </h1>
        <p style={{ margin: 0, fontSize: "10px", color: "#888" }}>Daňový doklad</p>
      </div>

      {/* Two column: Supplier / Customer */}
      <div style={{ display: "flex", gap: "40px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.5px" }}>
            Dodavatel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px", fontSize: "11px" }}>{invoice.supplier_name || ""}</p>
          <p style={{ margin: "0 0 1px", fontSize: "10px" }}>{invoice.supplier_address || ""}</p>
          {invoice.supplier_ico && <p style={{ margin: "0 0 1px", fontSize: "10px" }}>IČO: {invoice.supplier_ico}</p>}
          {invoice.supplier_dic && <p style={{ margin: 0, fontSize: "10px" }}>DIČ: {invoice.supplier_dic}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.5px" }}>
            Odběratel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px", fontSize: "11px" }}>{invoice.client_name || "—"}</p>
          <p style={{ margin: "0 0 1px", fontSize: "10px" }}>{invoice.client_address || ""}</p>
          {invoice.client_ico && <p style={{ margin: "0 0 1px", fontSize: "10px" }}>IČO: {invoice.client_ico}</p>}
          {invoice.client_dic && <p style={{ margin: 0, fontSize: "10px" }}>DIČ: {invoice.client_dic}</p>}
        </div>
      </div>

      {/* 3-column detail: Dates | Symbols | Bank */}
      <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #ddd", padding: "8px 0", marginBottom: "16px", display: "flex", gap: "16px", fontSize: "9px" }}>
        {/* Col 1: Dates stacked */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Datum vystavení</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(invoice.issue_date)}</p>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>DUZP</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(taxableDate)}</p>
          </div>
          <div>
            <span style={{ color: "#888" }}>Datum splatnosti</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(invoice.due_date)}</p>
          </div>
        </div>
        {/* Col 2: Symbols stacked */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Variabilní symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.variable_symbol || "—"}</p>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Specifický symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.specific_symbol || "—"}</p>
          </div>
          <div>
            <span style={{ color: "#888" }}>Konstantní symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.constant_symbol || "—"}</p>
          </div>
        </div>
        {/* Col 3: Bank stacked */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Bankovní účet</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.bank_account || DEFAULT_BANK_ACCOUNT}</p>
          </div>
          {invoice.iban && (
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#888" }}>IBAN</span>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.iban}</p>
            </div>
          )}
          <div>
            <span style={{ color: "#888" }}>Měna</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{curSymbol}</p>
          </div>
        </div>
      </div>

      {/* Items table */}
      {Array.isArray(invoice.items) && invoice.items.length > 0 && invoice.items.some((it: any) => it.text || it.unit_price > 0) && (() => {
        const typedItems = invoice.items as InvoiceItem[];
        const vatGroups = new Map<number, { base: number; vat: number }>();
        typedItems.forEach((it) => {
          const lineBase = it.quantity * it.unit_price;
          const lineVat = lineBase * (it.vat_rate / 100);
          const existing = vatGroups.get(it.vat_rate) || { base: 0, vat: 0 };
          vatGroups.set(it.vat_rate, { base: existing.base + lineBase, vat: existing.vat + lineVat });
        });
        const subtotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);
        const vatTotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
        return (
          <div style={{ marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "4px 3px", fontWeight: "bold" }}>Popis</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "40px" }}>Ks</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "80px", whiteSpace: "nowrap" }}>Cena/ks bez DPH</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "70px" }}>Základ</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "40px" }}>DPH</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "65px", whiteSpace: "nowrap" }}>DPH {curSymbol}</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "75px" }}>Celkem</th>
                </tr>
              </thead>
              <tbody>
                {typedItems.map((it, idx) => {
                  const lb = it.quantity * it.unit_price;
                  const lv = lb * (it.vat_rate / 100);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "4px 3px" }}>{it.text}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px" }}>{it.quantity}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(it.unit_price)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(lb)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px" }}>{it.vat_rate}%</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(lv)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmtCur(lb + lv)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid #ccc" }}>
                  <td colSpan={6} style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold" }}>Základ celkem:</td>
                  <td style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", whiteSpace: "nowrap" }}>{fmtCur(subtotal)}</td>
                </tr>
                {Array.from(vatGroups.entries()).map(([rate, { base, vat }]) => (
                  <tr key={rate}>
                    <td colSpan={6} style={{ textAlign: "right", padding: "2px 3px", fontSize: "9px" }}>DPH {rate}% (základ {fmt(base)}):</td>
                    <td style={{ textAlign: "right", padding: "2px 3px", fontSize: "9px", whiteSpace: "nowrap" }}>{fmtCur(vat)}</td>
                  </tr>
                ))}
                {vatTotal > 0 && vatGroups.size > 1 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "right", padding: "2px 3px", fontWeight: "bold" }}>DPH celkem:</td>
                    <td style={{ textAlign: "right", padding: "2px 3px", fontWeight: "bold", whiteSpace: "nowrap" }}>{fmtCur(vatTotal)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #000" }}>
                  <td colSpan={6} style={{ textAlign: "right", padding: "5px 3px", fontWeight: "bold", fontSize: "12px" }}>Celkem k úhradě:</td>
                  <td style={{ textAlign: "right", padding: "5px 3px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}>{fmtCur(subtotal + vatTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {/* Amount (shown when no items) */}
      {(!Array.isArray(invoice.items) || !invoice.items.length || !invoice.items.some((it: any) => it.text || it.unit_price > 0)) && (
      <div style={{ background: "#f8f8f8", borderRadius: "6px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: "bold" }}>Celkem k úhradě</span>
        <span style={{ fontSize: "18px", fontWeight: "bold", whiteSpace: "nowrap" }}>{formatAmount(invoice.total_amount)}</span>
      </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Poznámka</h3>
          <p style={{ margin: 0, fontSize: "10px" }}>{invoice.notes}</p>
        </div>
      )}

      {/* QR Code */}
      {qrUrl && (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={qrUrl} alt="QR platba" style={{ width: "120px", height: "120px" }} />
          <div>
            <p style={{ fontWeight: "bold", margin: "0 0 3px", fontSize: "10px" }}>QR platba</p>
            <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666" }}>Naskenujte kód pro rychlou úhradu</p>
            <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666", whiteSpace: "nowrap" }}>Částka: {formatAmount(invoice.total_amount)}</p>
            {invoice.variable_symbol && <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666" }}>VS: {invoice.variable_symbol}</p>}
            {invoice.due_date && <p style={{ margin: 0, fontSize: "9px", color: "#666" }}>Splatnost: {formatDate(invoice.due_date)}</p>}
          </div>
        </div>
      )}

      {/* Foreign currency note */}
      {cur !== "CZK" && (
        <div style={{ marginBottom: "12px", fontSize: "8px", color: "#666" }}>
          Faktura vystavena v měně {cur}. Dle § 4 odst. 15 zákona č. 235/2004 Sb. se přepočet na CZK provádí kurzem ČNB ke dni uskutečnění zdanitelného plnění.
        </div>
      )}

      <div style={{ marginTop: "20px", borderTop: "1px solid #ddd", paddingTop: "8px", textAlign: "center", color: "#999", fontSize: "8px" }}>
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
  onOpenFile,
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
  onOpenFile: (i: Invoice) => void;
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
              {type === "issued" && <TableHead>Číslo</TableHead>}
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
                {type === "issued" && <TableCell className="font-medium">{inv.invoice_number || "—"}</TableCell>}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onPdf(inv)}>
                          <FileText className="h-4 w-4 mr-2" /> Zobrazení faktury
                        </DropdownMenuItem>
                        {type === "issued" && (
                          <DropdownMenuItem onClick={() => onEmail(inv)}>
                            <Send className="h-4 w-4 mr-2" /> Odeslání
                          </DropdownMenuItem>
                        )}
                        {type === "issued" && (
                          <DropdownMenuItem onClick={() => onDuplicate(inv)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplikace
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(inv)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editace
                        </DropdownMenuItem>
                        {inv.currency === "CZK" && inv.total_amount && (
                          <DropdownMenuItem onClick={() => onQr(inv)}>
                            <QrCode className="h-4 w-4 mr-2" /> QR platba
                          </DropdownMenuItem>
                        )}
                        {(inv.file_url || inv.deal_supplier_invoice_id) && (
                          <DropdownMenuItem onClick={() => onOpenFile(inv)}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Otevřít soubor
                          </DropdownMenuItem>
                        )}
                        {!inv.deal_supplier_invoice_id && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(inv.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Smazání
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
