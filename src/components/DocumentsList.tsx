import { useState } from "react";
import { FileText, Download, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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

export function DocumentsList({ clientId, documents, onDelete }: DocumentsListProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>("");

  if (!documents || documents.length === 0) {
    return null;
  }

  const handleDelete = async (documentUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = documentUrl.split("/client-documents/");
      if (urlParts.length < 2) return;
      
      const filePath = urlParts[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("client-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Update client document_urls
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("document_urls")
        .eq("id", clientId)
        .single();

      if (!clientError && clientData) {
        const currentUrls = Array.isArray((clientData as any).document_urls) ? (clientData as any).document_urls : [];
        const newUrls = (currentUrls as unknown as Document[]).filter((doc) => doc.url !== documentUrl);
        
        await supabase
          .from("clients")
          .update({ document_urls: newUrls } as any)
          .eq("id", clientId);
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
      case "passport":
        return "Cestovní pas";
      case "id_card":
        return "Občanský průkaz";
      default:
        return "Jiný dokument";
    }
  };

  const handlePreview = (doc: Document) => {
    setPreviewUrl(doc.url);
    setPreviewType(doc.type);
  };

  const isImageUrl = (url: string) => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.jpg') || 
           lowerUrl.includes('.jpeg') || 
           lowerUrl.includes('.png') || 
           lowerUrl.includes('.webp') ||
           lowerUrl.includes('.gif');
  };

  const isPdfUrl = (url: string) => {
    return url.toLowerCase().includes('.pdf');
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
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{getDocumentTypeLabel(doc.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString("cs-CZ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handlePreview(doc)}
                    title="Náhled"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(doc.url, "_blank")}
                    title="Stáhnout"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(doc.url)}
                    title="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{getDocumentTypeLabel(previewType)}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              {isImageUrl(previewUrl) ? (
                <img 
                  src={previewUrl} 
                  alt={getDocumentTypeLabel(previewType)}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : isPdfUrl(previewUrl) ? (
                <iframe 
                  src={previewUrl}
                  className="w-full h-[70vh] rounded-lg"
                  title={getDocumentTypeLabel(previewType)}
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Náhled není dostupný pro tento typ souboru</p>
                  <Button onClick={() => window.open(previewUrl, "_blank")}>
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
