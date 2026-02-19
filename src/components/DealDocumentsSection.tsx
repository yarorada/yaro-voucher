import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Eye, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage, isImageFile } from "@/lib/imageCompression";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DealDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  description: string | null;
  uploaded_at: string;
}

interface DealDocumentsSectionProps {
  dealId: string;
}

export function DealDocumentsSection({ dealId }: DealDocumentsSectionProps) {
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from("deal_documents")
      .select("*")
      .eq("deal_id", dealId)
      .order("uploaded_at", { ascending: false });

    if (!error) setDocuments(data || []);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cestovní dokumenty</CardTitle>
        <CardDescription>
          Nahrávejte externí cestovní dokumenty (letenky, pojištění, vouchery od jiných dodavatelů)
        </CardDescription>
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

        {/* Documents list */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Načítání...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Zatím nejsou nahrány žádné dokumenty</p>
        ) : (
          <div className="space-y-2">
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewUrl(doc.file_url)} title="Náhled">
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(doc.file_url, "_blank")} title="Stáhnout">
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
      </CardContent>
    </Card>
  );
}
