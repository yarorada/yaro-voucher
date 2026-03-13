import { useState, useEffect, useRef, DragEvent, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateInput } from "@/components/ui/date-input";
import { Upload, FileText, Loader2, Download, Trash2, CheckCircle2, Receipt, Eye, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressImage, isImageFile } from "@/lib/imageCompression";
import { format } from "date-fns";

interface DealSupplierInvoicesProps {
  dealId: string;
}

interface SupplierInvoice {
  id: string;
  deal_id: string;
  file_url: string;
  file_name: string;
  supplier_name: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
}

interface OcrResult {
  supplier_name: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
}

export function DealSupplierInvoices({ dealId }: DealSupplierInvoicesProps) {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewIsImage, setPreviewIsImage] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null);
  const [editData, setEditData] = useState({
    supplier_name: "",
    total_amount: "" as string | number,
    currency: "CZK",
    issue_date: "",
    is_paid: false,
    paid_at: "",
    payment_method: "moneta",
  });

  // OCR confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFileUrl, setPendingFileUrl] = useState("");
  const [pendingFileName, setPendingFileName] = useState("");
  const [ocrData, setOcrData] = useState<OcrResult>({
    supplier_name: null,
    total_amount: null,
    currency: "CZK",
    issue_date: null,
  });

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from("deal_supplier_invoices")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setInvoices(data as unknown as SupplierInvoice[]);
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const downloadFileAsBlob = async (fileUrl: string): Promise<Blob | null> => {
    const parts = fileUrl.split("/supplier-invoices/");
    if (parts.length < 2) return null;
    const path = decodeURIComponent(parts[1]);

    // Try SDK download first
    try {
      const { data, error } = await supabase.storage.from("supplier-invoices").download(path);
      if (!error && data) return data;
    } catch (e) { console.warn("SDK download failed:", e); }

    // Try signed URL
    try {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("supplier-invoices").createSignedUrl(path, 300);
      if (!signedError && signedData?.signedUrl) {
        const res = await fetch(signedData.signedUrl);
        if (res.ok) return await res.blob();
      }
    } catch (e) { console.warn("Signed URL failed:", e); }

    // Try direct fetch
    try {
      const res = await fetch(fileUrl);
      if (res.ok) return await res.blob();
    } catch (e) { console.warn("Direct fetch failed:", e); }

    // Fallback: proxy through edge function (bypasses Comet blocking)
    try {
      const { data, error } = await supabase.functions.invoke("proxy-file", {
        body: { bucket: "supplier-invoices", path },
      });
      if (!error && data?.base64) {
        const binaryStr = atob(data.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new Blob([bytes], { type: data.contentType || "application/octet-stream" });
      }
    } catch (e) { console.warn("Proxy fallback failed:", e); }

    return null;
  };

  const handlePreview = async (inv: SupplierInvoice) => {
    setPreviewFileName(inv.file_name);
    setPreviewIsImage(/\.(jpe?g|png|webp|gif)$/i.test(inv.file_name));
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewBlobUrl(null);
    try {
      const blob = await downloadFileAsBlob(inv.file_url);
      if (blob) setPreviewBlobUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Preview download failed:", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewOpen(false);
    setPreviewBlobUrl(null);
  };

  const openPreviewInNewWindow = () => {
    if (previewBlobUrl) window.open(previewBlobUrl, "_blank");
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Soubor je příliš velký (max 20MB)");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Nepodporovaný formát. Použijte JPG, PNG, WEBP nebo PDF.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      let fileToUpload = file;

      // Compress images
      if (isImageFile(file)) {
        try {
          const compressed = await compressImage(file, 1920, 1920, 0.85);
          if (compressed.compressedSize < file.size) {
            fileToUpload = new File([compressed.blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
          }
        } catch { /* use original */ }
      }

      setUploadProgress(30);

      // Upload to storage
      const ext = file.name.split(".").pop();
      const path = `${dealId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-invoices")
        .upload(path, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("supplier-invoices")
        .getPublicUrl(path);

      const fileUrl = urlData.publicUrl;
      setUploadProgress(60);

      // Run OCR for images and PDFs
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (fileToUpload.type.startsWith("image/") || isPdf) {
        setOcrProcessing(true);
        setUploadProgress(70);

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(fileToUpload);
        });

        const { data: ocrResult, error: ocrError } = await supabase.functions.invoke(
          "ocr-supplier-invoice",
          { body: { imageBase64: base64 } }
        );

        setOcrProcessing(false);

        if (!ocrError && ocrResult?.data) {
          setOcrData({
            supplier_name: ocrResult.data.supplier_name || null,
            total_amount: ocrResult.data.total_amount || null,
            currency: ocrResult.data.currency || "CZK",
            issue_date: ocrResult.data.issue_date || null,
          });
        }
      }

      setPendingFileUrl(fileUrl);
      setPendingFileName(file.name);
      setUploadProgress(100);
      setConfirmDialogOpen(true);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Nahrávání se nezdařilo");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setOcrProcessing(false);
    }
  };

  const parseIssueDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(".");
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const handleConfirmSave = async () => {
    try {
      const { error } = await supabase.from("deal_supplier_invoices").insert({
        deal_id: dealId,
        file_url: pendingFileUrl,
        file_name: pendingFileName,
        supplier_name: ocrData.supplier_name,
        total_amount: ocrData.total_amount,
        currency: ocrData.currency || "CZK",
        issue_date: parseIssueDate(ocrData.issue_date),
      } as any);

      if (error) throw error;

      toast.success("Doklad uložen");
      setConfirmDialogOpen(false);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Uložení se nezdařilo");
    }
  };

  const resetForm = () => {
    setPendingFileUrl("");
    setPendingFileName("");
    setOcrData({ supplier_name: null, total_amount: null, currency: "CZK", issue_date: null });
  };

  const handleTogglePaid = async (invoice: SupplierInvoice) => {
    const newPaid = !invoice.is_paid;
    const { error } = await supabase
      .from("deal_supplier_invoices")
      .update({
        is_paid: newPaid,
        paid_at: newPaid ? new Date().toISOString().split("T")[0] : null,
        payment_method: newPaid ? (invoice.payment_method || "moneta") : null,
      } as any)
      .eq("id", invoice.id);

    if (!error) fetchInvoices();
  };

  const handleUpdatePayment = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from("deal_supplier_invoices")
      .update({ [field]: value } as any)
      .eq("id", id);

    if (!error) fetchInvoices();
  };

  const handleDelete = async (invoice: SupplierInvoice) => {
    if (!confirm("Opravdu smazat tento doklad?")) return;

    // Delete from storage
    const path = invoice.file_url.split("/supplier-invoices/")[1];
    if (path) {
      await supabase.storage.from("supplier-invoices").remove([path]);
    }

    const { error } = await supabase
      .from("deal_supplier_invoices")
      .delete()
      .eq("id", invoice.id);

    if (!error) {
      toast.success("Doklad smazán");
      fetchInvoices();
    }
  };

  const handleDownload = async (invoice: SupplierInvoice) => {
    try {
      const path = invoice.file_url.split("/supplier-invoices/")[1];
      if (!path) throw new Error("Invalid path");

      // Try SDK download first
      const { data, error } = await supabase.storage
        .from("supplier-invoices")
        .download(path);

      if (error || !data) {
        // Fallback: fetch directly
        const res = await fetch(invoice.file_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = invoice.file_name;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = invoice.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Stažení se nezdařilo");
    }
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (amount == null) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: currency || "CZK",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Doklady dodavatelům
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          {uploading || ocrProcessing ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {ocrProcessing ? "Zpracovávám OCR..." : "Nahrávám..."}
              </p>
              <Progress value={uploadProgress} className="h-1 max-w-xs mx-auto" />
            </div>
          ) : (
            <>
              <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-medium">
                {isDragging ? "Pusťte soubor zde" : "Přetáhněte fakturu sem"}
              </p>
              <p className="text-xs text-muted-foreground">nebo klikněte • JPG, PNG, WEBP, PDF (max 20MB)</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Invoices list */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dodavatel</TableHead>
                <TableHead className="text-right">Částka</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Zaplaceno</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Datum platby</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{inv.supplier_name || "-"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{inv.file_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {formatAmount(inv.total_amount, inv.currency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {inv.issue_date
                      ? (() => { const p = inv.issue_date.split("-"); return `${p[2]}.${p[1]}.${p[0]}`; })()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={inv.is_paid}
                      onCheckedChange={() => handleTogglePaid(inv)}
                    />
                  </TableCell>
                  <TableCell>
                    {inv.is_paid && (
                      <Select
                        value={inv.payment_method || "moneta"}
                        onValueChange={(v) => handleUpdatePayment(inv.id, "payment_method", v)}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moneta">Moneta</SelectItem>
                          <SelectItem value="amnis">Amnis</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {inv.is_paid && (
                      <Input
                        type="date"
                        value={inv.paid_at || ""}
                        onChange={(e) => handleUpdatePayment(inv.id, "paid_at", e.target.value || null)}
                        className="h-7 w-32 text-xs"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePreview(inv)} title="Náhled">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(inv)} title="Stáhnout">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inv)} title="Smazat">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Zatím žádné doklady</p>
        )}

        {/* OCR Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setConfirmDialogOpen(open);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Potvrdit údaje z dokladu</DialogTitle>
              <DialogDescription>
                Zkontrolujte a případně upravte údaje rozpoznané z dokladu „{pendingFileName}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Dodavatel</Label>
                <Input
                  value={ocrData.supplier_name || ""}
                  onChange={(e) => setOcrData((p) => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="Název dodavatele"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Částka</Label>
                  <Input
                    type="number"
                    value={ocrData.total_amount ?? ""}
                    onChange={(e) =>
                      setOcrData((p) => ({ ...p, total_amount: e.target.value ? Number(e.target.value) : null }))
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Měna</Label>
                  <Select
                    value={ocrData.currency || "CZK"}
                    onValueChange={(v) => setOcrData((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CZK">CZK</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Datum vystavení (DD.MM.YYYY)</Label>
                <Input
                  value={ocrData.issue_date || ""}
                  onChange={(e) => setOcrData((p) => ({ ...p, issue_date: e.target.value }))}
                  placeholder="01.01.2025"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); resetForm(); }}>
                Zrušit
              </Button>
              <Button onClick={handleConfirmSave}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Potvrdit a uložit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview dialog */}
        <Dialog open={previewOpen} onOpenChange={closePreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
            <DialogHeader>
              <DialogTitle>Náhled dokladu</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[70vh]">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-sm truncate max-w-[300px]">{previewFileName}</span>
                  </div>
                  {previewBlobUrl && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={openPreviewInNewWindow}>
                      <ExternalLink className="h-4 w-4" />
                      Nové okno
                    </Button>
                  )}
                </div>
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : previewIsImage ? (
                  previewBlobUrl ? (
                    <img src={previewBlobUrl} alt="Doklad" className="max-w-full max-h-[400px] object-contain mx-auto rounded border" />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Náhled nelze zobrazit</p>
                  )
                ) : previewBlobUrl ? (
                  <iframe src={previewBlobUrl} className="w-full h-[60vh] rounded border" title="PDF náhled" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Náhled nelze zobrazit</p>
                )}
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
