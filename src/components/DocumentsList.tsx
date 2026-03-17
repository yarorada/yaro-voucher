import { useState } from "react";
import { FileText, Download, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Document {
  url: string;
  type: string;
  uploadedAt: string;
}

interface DocumentsListProps {
  clientId: string;
  documents: Document[];
  onDelete?: () => void;
}

type MimeHint = "image" | "pdf" | "other";

function getMimeHint(url: string): MimeHint {
  const lower = url.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png") || lower.includes(".webp") || lower.includes(".gif")) return "image";
  if (lower.includes(".pdf")) return "pdf";
  return "other";
}

export function DocumentsList({ clientId, documents, onDelete }: DocumentsListProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>("");
  // Derived from the *original* URL before download — blob URLs have no extension
  const [previewMime, setPreviewMime] = useState<MimeHint>("other");

  if (!documents || documents.length === 0) {
    return null;
  }

  const handleDelete = async (documentUrl: string) => {
    try {
      const urlParts = documentUrl.split("/client-documents/");
      if (urlParts.length < 2) return;
      const filePath = urlParts[1];

      const { error: storageError } = await supabase.storage
        .from("client-documents")
        .remove([filePath]);
      if (storageError) throw storageError;

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("document_urls")
        .eq("id", clientId)
        .single();

      if (!clientError && clientData) {
        const currentUrls = Array.isArray((clientData as any).document_urls) ? (clientData as any).document_urls : [];
        const newUrls = (currentUrls as unknown as Document[]).filter((doc) => doc.url !== documentUrl);
        await supabase.from("clients").update({ document_urls: newUrls } as any).eq("id", clientId);
      }

      toast.success("Dokument byl smazán");
      onDelete?.();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Nepodařilo se smazat dokument");
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case "passport": return "Cestovní pas";
      case "id_card": return "Občanský průkaz";
      default: return "Jiný dokument";
    }
  };

  const handlePreview = async (doc: Document) => {
    // Determine mime from original URL *before* creating blob
    const mime = getMimeHint(doc.url);
    setPreviewMime(mime);
    setPreviewType(doc.type);
    setPreviewUrl(doc.url); // show dialog immediately

    const parts = doc.url.split("/client-documents/");
    if (parts.length >= 2) {
      try {
        const storagePath = decodeURIComponent(parts[1]);
        const { data, error } = await supabase.storage.from("client-documents").download(storagePath);
        if (error || !data) throw error;
        setPreviewUrl(URL.createObjectURL(data));
      } catch {
        // keep original URL as fallback
      }
    }
  };

  const closePreview = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const downloadDoc = async (doc: Document) => {
    const parts = doc.url.split("/client-documents/");
    if (parts.length >= 2) {
      try {
        const storagePath = decodeURIComponent(parts[1]);
        const { data, error } = await supabase.storage.from("client-documents").download(storagePath);
        if (error || !data) throw error;
        const blobUrl = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = doc.type || "document";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      } catch { /* fallback */ }
    }
    window.open(doc.url, "_blank");
  };

  return (
    <>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Nahrané dokumenty</h4>
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getMimeHint(doc.url) === "image" ? (
                    <button
                      onClick={() => handlePreview(doc)}
                      className="shrink-0 w-10 h-10 rounded border overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                      title="Náhled"
                    >
                      <img
                        src={doc.url}
                        alt={getDocumentTypeLabel(doc.type)}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </button>
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{getDocumentTypeLabel(doc.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString("cs-CZ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handlePreview(doc)} title="Náhled">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => downloadDoc(doc)} title="Stáhnout">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(doc.url)} title="Smazat">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{getDocumentTypeLabel(previewType)}</DialogTitle>
            <DialogDescription>Náhled dokumentu klienta</DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              {previewMime === "image" ? (
                <img
                  src={previewUrl}
                  alt={getDocumentTypeLabel(previewType)}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : previewMime === "pdf" ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] rounded-lg"
                  title={getDocumentTypeLabel(previewType)}
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Náhled není dostupný pro tento typ souboru</p>
                  <Button onClick={() => window.open(previewUrl!, "_blank")}>
                    <Download className="h-4 w-4 mr-2" />
                    Otevřít v novém okně
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
