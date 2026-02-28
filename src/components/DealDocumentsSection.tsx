import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { jsPDF } from "jspdf";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Eye, Download, Loader2, ExternalLink, Send, Clock, Mail } from "lucide-react";
import { cn, removeDiacritics } from "@/lib/utils";
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

interface OcrResult {
  first_name?: string;
  last_name?: string;
  passport_number?: string;
  passport_expiry?: string;
  id_card_number?: string;
  id_card_expiry?: string;
  date_of_birth?: string;
}

interface DealVoucher {
  id: string;
  voucher_code: string;
  client_name: string;
  supplier_id: string | null;
  sent_at: string | null;
  created_at: string;
  suppliers?: { name: string; email?: string | null } | null;
}

interface DealDocumentsSectionProps {
  dealId: string;
  clientEmail?: string | null;
  clientName?: string;
  startDate?: string | null;
  autoSendDocuments?: boolean;
  documentsAutoSentAt?: string | null;
}

export function DealDocumentsSection({ dealId, clientEmail, clientName, startDate, autoSendDocuments, documentsAutoSentAt }: DealDocumentsSectionProps) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [vouchers, setVouchers] = useState<DealVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingVoucherId, setSendingVoucherId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [ccSuppliers, setCcSuppliers] = useState(true);
  const [ocrProcessing, setOcrProcessing] = useState(false);
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
        .select("id, voucher_code, client_name, supplier_id, sent_at, created_at, suppliers:supplier_id(name, email)")
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

  const runOcrOnImage = async (file: File) => {
    try {
      setOcrProcessing(true);
      toast.info("Zpracovávám dokument pomocí OCR...");

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      // Try passport first, then ID card
      for (const docType of ["passport", "id_card"] as const) {
        const { data, error } = await supabase.functions.invoke("ocr-document", {
          body: { imageBase64: base64, documentType: docType },
        });

        if (error) {
          console.error("OCR error:", error);
          continue;
        }

        const extracted: OcrResult = data?.data;
        if (!extracted) continue;

        // Check if we got meaningful data
        const hasPassport = !!extracted.passport_number;
        const hasIdCard = !!extracted.id_card_number;
        const hasName = !!extracted.first_name || !!extracted.last_name;

        if (!hasPassport && !hasIdCard && !hasName) continue;

        // Find matching traveler by name or update lead traveler
        const { data: travelers } = await supabase
          .from("deal_travelers")
          .select("client_id, is_lead_traveler, clients:client_id(id, first_name, last_name)")
          .eq("deal_id", dealId);

        if (!travelers || travelers.length === 0) break;

        // Try to match by name, fall back to lead traveler
        let targetClientId: string | null = null;
        if (extracted.first_name && extracted.last_name) {
          const match = travelers.find((t: any) => {
            const c = t.clients;
            return c?.first_name?.toLowerCase() === extracted.first_name?.toLowerCase() &&
                   c?.last_name?.toLowerCase() === extracted.last_name?.toLowerCase();
          });
          if (match) targetClientId = match.client_id;
        }
        if (!targetClientId) {
          const lead = travelers.find((t: any) => t.is_lead_traveler);
          targetClientId = lead?.client_id || travelers[0]?.client_id;
        }

        if (!targetClientId) break;

        // Parse date helper
        const parseDate = (dateStr: string): string | null => {
          if (!dateStr) return null;
          const parts = dateStr.split(".");
          if (parts.length !== 3) return null;
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          return new Date(Date.UTC(year, month - 1, day)).toISOString().split("T")[0];
        };

        const updateData: any = {};
        if (extracted.passport_number) updateData.passport_number = extracted.passport_number;
        if (extracted.passport_expiry) {
          const d = parseDate(extracted.passport_expiry);
          if (d) updateData.passport_expiry = d;
        }
        if (extracted.id_card_number) updateData.id_card_number = extracted.id_card_number;
        if (extracted.id_card_expiry) {
          const d = parseDate(extracted.id_card_expiry);
          if (d) updateData.id_card_expiry = d;
        }
        if (extracted.date_of_birth) {
          const d = parseDate(extracted.date_of_birth);
          if (d) updateData.date_of_birth = d;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("clients")
            .update(updateData as any)
            .eq("id", targetClientId);

          if (!updateError) {
            const name = extracted.first_name && extracted.last_name
              ? `${extracted.first_name} ${extracted.last_name}`
              : "klienta";
            toast.success(`OCR: Data z dokladu uložena pro ${name}`);
          } else {
            console.error("Client update error:", updateError);
            toast.error("Nepodařilo se uložit data z OCR");
          }
        }
        break; // Found valid data, stop trying
      }
    } catch (err) {
      console.error("OCR processing error:", err);
      toast.error("OCR zpracování selhalo");
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    
    const ocrCandidateFiles: File[] = [];
    
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: Soubor je příliš velký (max 20MB)`);
        continue;
      }

      try {
        let fileToUpload = file;
        const isPdfFile = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

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
          ocrCandidateFiles.push(fileToUpload);
        } else if (isPdfFile) {
          ocrCandidateFiles.push(file);
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
          file_type: fileToUpload.type || file.type,
        } as any);

        toast.success(`${file.name} nahráno`);
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(`Chyba při nahrávání ${file.name}`);
      }
    }

    setUploading(false);
    fetchDocuments();

    // Run OCR on uploaded images (after upload completes)
    for (const ocrFile of ocrCandidateFiles) {
      await runOcrOnImage(ocrFile);
    }
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

  const isImage = (urlOrType: string) => /\.(jpg|jpeg|png|webp|gif)/i.test(urlOrType) || /^image\//i.test(urlOrType);
  const isPdf = (urlOrType: string) => /\.pdf/i.test(urlOrType) || urlOrType === "application/pdf";

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const downloadFileAsBlob = async (fileUrl: string, bucket: string): Promise<Blob | null> => {
    const parts = fileUrl.split(`/${bucket}/`);
    if (parts.length < 2) return null;
    const storagePath = decodeURIComponent(parts[1]);

    // 1. Try proxy-file edge function first (bypasses Comet domain blocking)
    try {
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-file", {
        body: { bucket, path: storagePath },
      });
      if (!proxyError && proxyData?.base64) {
        const byteChars = atob(proxyData.base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        return new Blob([byteArr], { type: proxyData.contentType || "application/octet-stream" });
      }
      console.warn("Proxy-file failed:", proxyError);
    } catch (e) {
      console.warn("Proxy-file exception:", e);
    }

    // 2. Fallback: SDK download
    try {
      const { data, error } = await supabase.storage.from(bucket).download(storagePath);
      if (!error && data) return data;
      console.warn("SDK download failed:", error);
    } catch (e) {
      console.warn("SDK download exception:", e);
    }

    // 3. Fallback: signed URL
    try {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 300);
      if (!signedError && signedData?.signedUrl) {
        const res = await fetch(signedData.signedUrl);
        if (res.ok) return await res.blob();
      }
    } catch (e) {
      console.warn("Signed URL fallback failed:", e);
    }

    return null;
  };

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const handlePreview = async (doc: DealDocument) => {
    setPreviewUrl(doc.file_url);
    setPreviewFileType(doc.file_type);
    setPreviewLoading(true);
    setPreviewBlobUrl(null);
    setPreviewDataUrl(null);
    try {
      // Try proxy-file first to get base64 — use data: URL to avoid any network blocking
      const parts = doc.file_url.split(`/deal-documents/`);
      if (parts.length >= 2) {
        const storagePath = decodeURIComponent(parts[1]);
        const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-file", {
          body: { bucket: "deal-documents", path: storagePath },
        });
        if (!proxyError && proxyData?.base64) {
          const contentType = proxyData.contentType || "application/octet-stream";
          const dataUrl = `data:${contentType};base64,${proxyData.base64}`;
          setPreviewDataUrl(dataUrl);
          setPreviewLoading(false);
          return;
        }
      }
      // Fallback: blob URL
      const blob = await downloadFileAsBlob(doc.file_url, "deal-documents");
      if (blob) {
        setPreviewBlobUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error("Preview download failed:", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewUrl(null);
    setPreviewBlobUrl(null);
    setPreviewDataUrl(null);
  };

  const openInNewWindow = async () => {
    if (previewDataUrl) {
      const a = document.createElement("a");
      a.href = previewDataUrl;
      a.target = "_blank";
      a.click();
    } else if (previewBlobUrl) {
      window.open(previewBlobUrl, "_blank");
    } else if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  };

  const downloadViaBlob = async (doc: DealDocument) => {
    try {
      const blob = await downloadFileAsBlob(doc.file_url, "deal-documents");
      if (!blob) throw new Error("Download failed");
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast.error("Nepodařilo se stáhnout soubor");
    }
  };

  const totalItems = documents.length + vouchers.length;

  // Get unique supplier emails from vouchers
  const supplierEmails = Array.from(
    new Set(
      vouchers
        .filter((v) => v.suppliers?.email)
        .map((v) => v.suppliers!.email!)
    )
  );

  const openSendDialog = () => {
    const name = clientName || "klient";
    setEmailSubject(`Cestovní dokumenty - YARO Travel`);
    setEmailBody(
      `Vážený ${name},\n\nv příloze zasíláme kompletní cestovní dokumenty k Vašemu zájezdu.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`
    );
    setCcSuppliers(supplierEmails.length > 0);
    setSendDialogOpen(true);
  };

  // Build voucher PDF using jsPDF directly (no html2canvas, works in all environments)
  const buildVoucherPdfBlob = (fullVoucher: any, supplierName?: string): Blob => {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const W = 210;
    const margin = 15;
    let y = margin;

    const fmtDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,"0")}.${String(dt.getMonth()+1).padStart(2,"0")}.${dt.getFullYear()}`;
    };

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("YARO Travel", margin, y);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`VOUCHER ${fullVoucher.voucher_code}`, W - margin, y, { align: "right" });
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Issued: ${fmtDate(fullVoucher.issue_date)}`, W - margin, y, { align: "right" });
    y += 6;

    // Blue line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 6;

    // Client info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`Client: ${removeDiacritics(fullVoucher.client_name || "")}`, margin, y); y += 5;
    if (fullVoucher.hotel_name) { doc.text(`Hotel: ${fullVoucher.hotel_name}`, margin, y); y += 5; }
    if (supplierName) { doc.text(`Supplier: ${supplierName}`, margin, y); y += 5; }
    y += 3;

    // Services
    const services = (fullVoucher.services as any[]) || [];
    if (services.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Services", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, W - margin * 2, 6, "F");
      doc.setTextColor(0, 0, 0);
      doc.text("Service", margin + 2, y + 4);
      doc.text("From", margin + 80, y + 4);
      doc.text("To", margin + 110, y + 4);
      doc.text("Pax", margin + 140, y + 4);
      y += 6;

      for (const s of services) {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, y, W - margin * 2, 6);
        doc.text((s.name || s.service || "").substring(0, 45), margin + 2, y + 4);
        doc.text(s.dateFrom ? fmtDate(s.dateFrom) : "", margin + 80, y + 4);
        doc.text(s.dateTo ? fmtDate(s.dateTo) : "", margin + 110, y + 4);
        doc.text(String(s.pax || s.person_count || 1), margin + 140, y + 4);
        y += 6;
      }
      y += 4;
    }

    // Flights
    const flights = (fullVoucher.flights as any[]) || [];
    if (flights.length > 0) {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Flights", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, W - margin * 2, 6, "F");
      doc.text("Route", margin + 2, y + 4);
      doc.text("Date", margin + 70, y + 4);
      doc.text("Flight", margin + 120, y + 4);
      y += 6;

      for (const f of flights) {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, y, W - margin * 2, 6);
        doc.text(`${f.fromIata || f.departure || ""} → ${f.toIata || f.arrival || ""}`, margin + 2, y + 4);
        doc.text(`${f.date ? fmtDate(f.date) : ""} ${f.departureTime || f.time || ""}`, margin + 70, y + 4);
        doc.text(f.flightNumber || "", margin + 120, y + 4);
        y += 6;
      }
      y += 4;
    }

    // Tee Times
    const teeTimes = (fullVoucher.tee_times as any[]) || [];
    if (teeTimes.length > 0) {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Confirmed Tee Times", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, W - margin * 2, 6, "F");
      doc.text("Date", margin + 2, y + 4);
      doc.text("Time", margin + 40, y + 4);
      doc.text("Course", margin + 70, y + 4);
      doc.text("Players", margin + 140, y + 4);
      y += 6;

      for (const t of teeTimes) {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, y, W - margin * 2, 6);
        doc.text(t.date ? fmtDate(t.date) : "", margin + 2, y + 4);
        doc.text(t.time || "", margin + 40, y + 4);
        doc.text((t.club || t.course || "").substring(0, 40), margin + 70, y + 4);
        doc.text(String(t.golfers || t.players || ""), margin + 140, y + 4);
        y += 6;
      }
      y += 4;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, 285, W - margin, 285);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text("YARO Travel · Tel.: +420 602 102 108 · www.yarotravel.cz · zajezdy@yarotravel.cz", margin, 290);
    }

    return doc.output("blob");
  };

   // Generate a simple voucher PDF and upload to deal-documents
  const generateVoucherPdf = async (voucher: DealVoucher): Promise<boolean> => {
    try {
      const { data: fullVoucher, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", voucher.id)
        .single();
      if (error || !fullVoucher) return false;

      const pdfBlob = buildVoucherPdfBlob(fullVoucher, voucher.suppliers?.name);

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
          ccEmails: ccSuppliers ? supplierEmails : [],
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Chyba při odesílání");

      const ccInfo = ccSuppliers && supplierEmails.length > 0 ? ` + CC: ${supplierEmails.join(", ")}` : "";
      toast.success(`E-mail odeslán na ${clientEmail}${ccInfo} (${data.attachmentCount} příloh)`);
      setSendDialogOpen(false);
    } catch (err: any) {
      console.error("Send error:", err);
      toast.error(err.message || "Nepodařilo se odeslat dokumenty");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteVoucher = async (voucher: DealVoucher) => {
    if (!confirm(`Opravdu chcete smazat voucher ${voucher.voucher_code}? Tato akce je nevratná.`)) return;
    try {
      await supabase.from("voucher_travelers").delete().eq("voucher_id", voucher.id);
      const { error } = await supabase.from("vouchers").delete().eq("id", voucher.id);
      if (error) throw error;
      toast.success(`Voucher ${voucher.voucher_code} smazán`);
      fetchDocuments();
    } catch {
      toast.error("Nepodařilo se smazat voucher");
    }
  };

  const handleSendVoucher = async (voucher: DealVoucher) => {
    setSendingVoucherId(voucher.id);
    try {
      // Check client email first
      const { data: travelerData } = await supabase
        .from("voucher_travelers")
        .select("is_main_client, clients:client_id(email, first_name, last_name)")
        .eq("voucher_id", voucher.id)
        .eq("is_main_client", true)
        .limit(1)
        .single();

      const clientEmail = (travelerData?.clients as any)?.email;
      if (!clientEmail) {
        // Try fallback via voucher.client_id
        const { data: voucherRow } = await supabase
          .from("vouchers")
          .select("client_id, clients:client_id(email, first_name, last_name)")
          .eq("id", voucher.id)
          .single();
        const fallbackEmail = (voucherRow?.clients as any)?.email;
        if (!fallbackEmail) {
          toast.error(`Klient ${voucher.client_name} nemá vyplněný e-mail. Doplňte e-mail v kartě klienta.`);
          setSendingVoucherId(null);
          return;
        }
      }

      // Fetch full voucher data to generate PDF
      const { data: fullVoucher } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", voucher.id)
        .single();

      let pdfPath: string | null = null;

      if (fullVoucher) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const pdfBlob = buildVoucherPdfBlob(fullVoucher, voucher.suppliers?.name);

            // Upload to voucher-pdfs bucket (where send-voucher-email expects it)
            const voucherPdfPath = `${user.id}/${fullVoucher.voucher_code}-${Date.now()}.pdf`;
            const { error: uploadErr } = await supabase.storage
              .from("voucher-pdfs")
              .upload(voucherPdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });

            if (!uploadErr) {
              pdfPath = voucherPdfPath;
            }
          }
        } catch (pdfErr) {
          console.error("PDF generation error:", pdfErr);
          // Continue without PDF
        }
      }

      // Use the send-voucher-email edge function
      const { data, error } = await supabase.functions.invoke("send-voucher-email", {
        body: {
          voucherId: voucher.id,
          pdfPath,
          emailCcSupplier: !!voucher.suppliers?.email,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Chyba při odesílání");

      const recipients = (data.results || [])
        .filter((r: any) => r.success)
        .map((r: any) => r.recipient)
        .join(", ");
      toast.success(`Voucher ${voucher.voucher_code} odeslán: ${recipients}`);
      fetchDocuments();
    } catch (err: any) {
      console.error("Send voucher error:", err);
      toast.error(err.message || "Nepodařilo se odeslat voucher");
    } finally {
      setSendingVoucherId(null);
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
                Odeslat klientovi{supplierEmails.length > 0 ? " a dodavateli" : ""}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-send toggle */}
        {startDate && clientEmail && (
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="auto-send-toggle" className="text-sm font-medium cursor-pointer">
                  Automaticky odeslat dokumenty 7 dní před odjezdem
                </Label>
                {documentsAutoSentAt && (
                  <p className="text-xs text-green-600 mt-0.5">
                    ✓ Automaticky odesláno {new Date(documentsAutoSentAt).toLocaleDateString("cs-CZ")}
                  </p>
                )}
              </div>
            </div>
            <Switch
              id="auto-send-toggle"
              checked={autoSendDocuments || false}
              disabled={!!documentsAutoSentAt}
              onCheckedChange={async (checked) => {
                const { error } = await supabase
                  .from("deals")
                  .update({ auto_send_documents: checked })
                  .eq("id", dealId);
                if (error) {
                  toast.error("Nepodařilo se uložit nastavení");
                } else {
                  toast.success(checked ? "Automatické odesílání zapnuto" : "Automatické odesílání vypnuto");
                  window.dispatchEvent(new CustomEvent("deal-updated"));
                }
              }}
            />
          </div>
        )}

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
          {uploading || ocrProcessing ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          ) : (
            <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-primary" : "text-muted-foreground")} />
          )}
          <p className="text-sm font-medium">
            {uploading ? "Nahrávám..." : ocrProcessing ? "Zpracovávám OCR..." : "Přetáhněte soubory sem nebo klikněte"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF, WEBP (max 20MB) · Obrázky dokladů budou automaticky zpracovány OCR</p>
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
                      {v.sent_at && (
                        <span className="text-green-600 dark:text-green-400"> · ✓ Odesláno</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleSendVoucher(v)}
                    disabled={sendingVoucherId === v.id}
                    title={`Odeslat klientovi${v.suppliers?.email ? ` a dodavateli (${v.suppliers.email})` : ""}`}
                  >
                    {sendingVoucherId === v.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                    {v.sent_at ? "Znovu" : "Odeslat"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => navigate(`/vouchers/${v.id}`)}
                    title="Otevřít voucher"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteVoucher(v)}
                    title="Smazat voucher"
                  >
                    <Trash2 className="h-3 w-3" />
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePreview(doc)} title="Náhled">
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadViaBlob(doc)} title="Stáhnout">
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)} title="Smazat">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview dialog */}
        <Dialog open={!!previewUrl} onOpenChange={closePreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
            <DialogHeader>
              <DialogTitle>Náhled dokumentu</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="overflow-y-auto max-h-[70vh]">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Dokument</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={openInNewWindow}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Nové okno
                    </Button>
                  </div>
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (previewFileType && isPdf(previewFileType)) || isPdf(previewUrl) ? (
                    <iframe
                      src={previewDataUrl || previewBlobUrl || previewUrl || undefined}
                      className="w-full h-[60vh] rounded border"
                      title="PDF náhled"
                    />
                  ) : (previewFileType && isImage(previewFileType)) || isImage(previewUrl) ? (
                    <img
                      src={previewDataUrl || previewBlobUrl || previewUrl || undefined}
                      alt="Dokument"
                      className="max-w-full max-h-[400px] object-contain mx-auto rounded border"
                    />
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-8 text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-3">Náhled nelze zobrazit</p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={openInNewWindow}
                      >
                        Otevřít dokument
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send all dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Odeslat dokumenty</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Příjemce (klient)</Label>
                <Input value={clientEmail || ""} disabled className="mt-1" />
              </div>
              {supplierEmails.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <Label htmlFor="cc-suppliers-toggle" className="text-sm font-medium cursor-pointer">
                      Kopie dodavatelům (CC)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {supplierEmails.join(", ")}
                    </p>
                  </div>
                  <Switch
                    id="cc-suppliers-toggle"
                    checked={ccSuppliers}
                    onCheckedChange={setCcSuppliers}
                  />
                </div>
              )}
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
