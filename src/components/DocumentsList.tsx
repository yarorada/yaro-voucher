import { FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DocumentUpload } from "@/components/DocumentUpload";

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

  return (
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
                  onClick={() => window.open(doc.url, "_blank")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(doc.url)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
