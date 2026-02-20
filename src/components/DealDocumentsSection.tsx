import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import html2pdf from "html2pdf.js";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Eye, Download, Loader2, ExternalLink, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage, isImageFile } from "@/lib/imageCompression";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DealDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  description: string | null;
  uploaded_at: string;
}

interface DealVoucher {
  id: string;
  voucher_code: string;
  client_name: string;
  supplier_id: string | null;
  sent_at: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
}

interface DealDocumentsSectionProps {
  dealId: string;
  clientEmail?: string | null;
  clientName?: string;
}

export function DealDocumentsSection({ dealId, clientEmail, clientName }: DealDocumentsSectionProps) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [vouchers, setVouchers] = useState<DealVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    const [docsRes, vouchersRes] = await Promise.all([
      supabase
        .from("deal_documents")
        .select("*")
        .eq("deal_id", dealId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("vouchers")
        .select("id, voucher_code, client_name, supplier_id, sent_at, created_at, suppliers:supplier_id(name)")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false }),
    ]);

    if (!docsRes.error) setDocuments(docsRes.data || []);
    if (!vouchersRes.error) setVouchers((vouchersRes.data as any) || []);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: Soubor je příliš velký (max 20MB)`);
        continue;
      }

      try {
        let fileToUpload = file;

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

        const ext = file.name.split(".").pop();
        const path = `${dealId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("deal-documents")
          .upload(path, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("deal-documents")
          .getPublicUrl(path);

        await supabase.from("deal_documents").insert({
          deal_id: dealId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
        } as any);

        toast.success(`${file.name} nahráno`);
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(`Chyba při nahrávání ${file.name}`);
      }
    }

    setUploading(false);
    fetchDocuments();
  };

  const handleDelete = async (doc: DealDocument) => {
    try {
      const parts = doc.file_url.split("/deal-documents/");
      if (parts.length >= 2) {
        await supabase.storage.from("deal-documents").remove([parts[1]]);
      }
      await supabase.from("deal_documents").delete().eq("id", doc.id);
      toast.success("Dokument smazán");
      fetchDocuments();
    } catch {
      toast.error("Nepodařilo se smazat dokument");
    }
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)/i.test(url);
  const isPdf = (url: string) => /\.pdf/i.test(url);

  const totalItems = documents.length + vouchers.length;

  const openSendDialog = () => {
    const name = clientName || "klient";
    setEmailSubject(`Cestovní dokumenty - YARO Travel`);
    setEmailBody(
      `Vážený ${name},\n\nv příloze zasíláme kompletní cestovní dokumenty k Vašemu zájezdu.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`
    );
    setSendDialogOpen(true);
  };

  // Generate a simple voucher PDF and upload to deal-documents
  const generateVoucherPdf = async (voucher: DealVoucher): Promise<boolean> => {
    try {
      // Fetch full voucher data
      const { data: fullVoucher, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", voucher.id)
        .single();
      if (error || !fullVoucher) return false;

      const formatDate = (d: string) => {
        if (!d) return "";
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
      };

      const services = (fullVoucher.services as any[]) || [];
      const flights = (fullVoucher.flights as any[]) || [];
      const teeTimes = (fullVoucher.tee_times as any[]) || [];

      // Compute expiration date = last service end date
      const allEndDates = services
        .map(s => s.dateTo || s.end_date)
        .filter(Boolean)
        .map(d => new Date(d).getTime());
      const lastServiceDate = allEndDates.length > 0 ? new Date(Math.max(...allEndDates)) : null;
      const expirationStr = lastServiceDate ? formatDate(lastServiceDate.toISOString()) : "";

      // Build HTML
      const servicesHtml = services.map(s => 
        `<tr><td style="padding:4px 8px;border:1px solid #ddd">${s.name || s.service || ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${s.dateFrom ? formatDate(s.dateFrom) : ""} - ${s.dateTo ? formatDate(s.dateTo) : ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${s.description || ""}</td></tr>`
      ).join("");

      const flightsHtml = flights.length > 0 ? `<h3 style="margin:12px 0 6px;font-size:13px">Flights</h3><table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#f0f0f0"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Route</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Date</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Flight</th></tr>${flights.map(f => `<tr><td style="padding:4px 8px;border:1px solid #ddd">${f.departure || ""} → ${f.arrival || ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${f.date ? formatDate(f.date) : ""} ${f.time || ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${f.flightNumber || ""}</td></tr>`).join("")}</table>` : "";

      const teeTimesHtml = teeTimes.length > 0 ? `<h3 style="margin:12px 0 6px;font-size:13px">Tee Times</h3><table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#f0f0f0"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Date</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Time</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Course</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Players</th></tr>${teeTimes.map(t => `<tr><td style="padding:4px 8px;border:1px solid #ddd">${t.date ? formatDate(t.date) : ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${t.time || ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${t.course || ""}</td><td style="padding:4px 8px;border:1px solid #ddd">${t.players || ""}</td></tr>`).join("")}</table>` : "";

      const html = `<div style="font-family:Arial,sans-serif;padding:20px;max-width:700px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <img src="${yaroLogo}" style="height:40px" />
          <div style="text-align:right"><h2 style="margin:0;font-size:16px">VOUCHER ${fullVoucher.voucher_code}</h2><p style="margin:2px 0;font-size:11px;color:#666">Issued: ${formatDate(fullVoucher.issue_date)}</p>${expirationStr ? `<p style="margin:2px 0;font-size:11px;color:#666">Valid until: ${expirationStr}</p>` : ""}</div>
        </div>
        <hr style="border:none;border-top:2px solid #2563eb;margin:8px 0 12px"/>
        <p style="font-size:12px;margin:4px 0"><strong>Client:</strong> ${fullVoucher.client_name}</p>
        ${fullVoucher.hotel_name ? `<p style="font-size:12px;margin:4px 0"><strong>Hotel:</strong> ${fullVoucher.hotel_name}</p>` : ""}
        ${voucher.suppliers?.name ? `<p style="font-size:12px;margin:4px 0"><strong>Supplier:</strong> ${voucher.suppliers.name}</p>` : ""}
        ${services.length > 0 ? `<h3 style="margin:12px 0 6px;font-size:13px">Services</h3><table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#f0f0f0"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Service</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Dates</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Description</th></tr>${servicesHtml}</table>` : ""}
        ${flightsHtml}
        ${teeTimesHtml}
        <div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#666">
          <p>YARO Travel · Tel.: +420 602 102 108 · www.yarotravel.cz · zajezdy@yarotravel.cz</p>
        </div>
      </div>`;

      // Create temp element and generate PDF
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.innerHTML = html;
      document.body.appendChild(container);

      const pdfBlob: Blob = await html2pdf().set({
        margin: [8, 8, 8, 8],
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(container).outputPdf("blob");

      document.body.removeChild(container);

      // Upload to deal-documents storage
      const path = `${dealId}/voucher-${fullVoucher.voucher_code}-${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage.from("deal-documents").upload(path, pdfBlob, { contentType: "application/pdf" });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("deal-documents").getPublicUrl(path);

      await supabase.from("deal_documents").insert({
        deal_id: dealId,
        file_name: `Voucher ${fullVoucher.voucher_code}.pdf`,
        file_url: urlData.publicUrl,
        file_type: "application/pdf",
        description: "Auto-generated voucher PDF",
      } as any);

      return true;
    } catch (err) {
      console.error("Error generating voucher PDF:", err);
      return false;
    }
  };

  const handleSendAll = async () => {
    if (!clientEmail) {
      toast.error("Klient nemá zadaný e-mail");
      return;
    }

    setSending(true);
    try {
      // Generate PDFs for vouchers that don't have a deal_document entry yet
      if (vouchers.length > 0) {
        const existingNames = documents.map(d => d.file_name.toLowerCase());
        const missingVouchers = vouchers.filter(v => 
          !existingNames.some(n => n.includes(v.voucher_code.toLowerCase()))
        );

        if (missingVouchers.length > 0) {
          toast.info(`Generuji ${missingVouchers.length} PDF voucherů...`);
          for (const v of missingVouchers) {
            await generateVoucherPdf(v);
          }
          // Refresh documents list so the edge function picks them up
          await fetchDocuments();
        }
      }

      // Re-check that there are documents to send
      const { data: freshDocs } = await supabase
        .from("deal_documents")
        .select("id")
        .eq("deal_id", dealId);

      if (!freshDocs || freshDocs.length === 0) {
        toast.error("Nejsou žádné dokumenty k odeslání");
        setSending(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-deal-documents", {
        body: {
          dealId,
          clientEmail,
          clientName: clientName || "",
          emailSubject,
          emailBody,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Chyba při odesílání");

      toast.success(`E-mail odeslán na ${clientEmail} (${data.attachmentCount} příloh)`);
      setSendDialogOpen(false);
    } catch (err: any) {
      console.error("Send error:", err);
      toast.error(err.message || "Nepodařilo se odeslat dokumenty");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cestovní dokumenty</CardTitle>
            <CardDescription>
              Vouchery a externí cestovní dokumenty (letenky, pojištění, vouchery od jiných dodavatelů)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {totalItems > 0 && (
              <Badge variant="secondary">{totalItems} položek</Badge>
            )}
            {(documents.length > 0 || vouchers.length > 0) && clientEmail && (
              <Button size="sm" variant="default" onClick={openSendDialog}>
                <Send className="h-4 w-4 mr-1" />
                Odeslat vše klientovi
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          ) : (
            <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-primary" : "text-muted-foreground")} />
          )}
          <p className="text-sm font-medium">{uploading ? "Nahrávám..." : "Přetáhněte soubory sem nebo klikněte"}</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF, WEBP (max 20MB)</p>
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          multiple
          className="hidden"
        />

        {/* Documents & vouchers list */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Načítání...</p>
        ) : totalItems === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Zatím nejsou nahrány žádné dokumenty</p>
        ) : (
          <div className="space-y-2">
            {/* Vouchers */}
            {vouchers.map((v) => (
              <div key={`v-${v.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">Voucher {v.voucher_code}</p>
                      <Badge variant="outline" className="text-xs shrink-0">Voucher</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.suppliers?.name || "—"} · {v.client_name}
                      {v.sent_at && " · Odesláno"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => navigate(`/vouchers/${v.id}`)}
                    title="Otevřít voucher"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Uploaded documents */}
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString("cs-CZ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Otevřít">
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </a>
                  <a href={doc.file_url} download={doc.file_name} title="Stáhnout">
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)} title="Smazat">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Náhled dokumentu</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="flex items-center justify-center">
                {isImage(previewUrl) ? (
                  <img src={previewUrl} alt="Dokument" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                ) : isPdf(previewUrl) ? (
                  <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" title="PDF" />
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Náhled není dostupný</p>
                    <Button onClick={() => window.open(previewUrl!, "_blank")}>
                      <Download className="h-4 w-4 mr-2" /> Otevřít
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send all dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Odeslat dokumenty klientovi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Příjemce</Label>
                <Input value={clientEmail || ""} disabled className="mt-1" />
              </div>
              <div>
                <Label>Předmět</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Text e-mailu</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="mt-1"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Bude odesláno <strong>{documents.length}</strong> {documents.length === 1 ? "dokument" : documents.length < 5 ? "dokumenty" : "dokumentů"}
                {vouchers.length > 0 && ` + ${vouchers.length} ${vouchers.length === 1 ? "voucher" : vouchers.length < 5 ? "vouchery" : "voucherů"} (PDF se vygeneruje automaticky)`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={sending}>
                Zrušit
              </Button>
              <Button onClick={handleSendAll} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Odesílám...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Odeslat
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
