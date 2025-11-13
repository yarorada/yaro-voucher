import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentUploadProps {
  clientId: string;
  documentType: "passport" | "id_card" | "other";
  onDataExtracted?: (data: any) => void;
  onUploadComplete?: (url: string) => void;
}

export function DocumentUpload({
  clientId,
  documentType,
  onDataExtracted,
  onUploadComplete,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Soubor je příliš velký. Maximální velikost je 20MB.");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Nepodporovaný formát souboru. Použijte JPG, PNG, WEBP nebo PDF.");
      return;
    }

    setUploading(true);

    try {
      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("client-documents")
        .getPublicUrl(fileName);

      const documentUrl = urlData.publicUrl;

      // If it's an image and we have a document type, process with OCR
      if (file.type.startsWith("image/") && documentType !== "other") {
        setProcessing(true);
        
        // Convert file to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Call OCR function
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
          "ocr-document",
          {
            body: {
              imageBase64: base64,
              documentType: documentType,
            },
          }
        );

        if (ocrError) {
          console.error("OCR error:", ocrError);
          toast.error("Nepodařilo se přečíst data z dokumentu");
        } else if (ocrData?.data) {
          toast.success("Data byla úspěšně načtena z dokumentu");
          onDataExtracted?.(ocrData.data);
        } else if (ocrData?.raw_content) {
          toast.info("Dokument byl načten, ale nepodařilo se extrahovat strukturovaná data");
        }
      }

      // Update client with document URL
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("document_urls")
        .eq("id", clientId)
        .single();

      if (!clientError && clientData) {
        const currentUrls = Array.isArray(clientData.document_urls) ? clientData.document_urls : [];
        const newUrls = [...currentUrls, { url: documentUrl, type: documentType, uploadedAt: new Date().toISOString() }];
        
        await supabase
          .from("clients")
          .update({ document_urls: newUrls })
          .eq("id", clientId);
      }

      toast.success("Dokument byl nahrán");
      onUploadComplete?.(documentUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Nepodařilo se nahrát dokument");
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
  };

  const getLabel = () => {
    switch (documentType) {
      case "passport":
        return "Nahrát sken cestovního pasu";
      case "id_card":
        return "Nahrát sken občanského průkazu";
      default:
        return "Nahrát dokument";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{getLabel()}</Label>
      
      {preview && (
        <div className="relative">
          <img src={preview} alt="Preview" className="max-h-48 rounded border" />
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={clearPreview}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          disabled={uploading || processing}
          className="hidden"
          id={`file-${documentType}`}
        />
        <Label
          htmlFor={`file-${documentType}`}
          className="flex-1 cursor-pointer"
        >
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={uploading || processing}
            asChild
          >
            <div>
              {uploading || processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading
                ? "Nahrávám..."
                : processing
                ? "Zpracovávám..."
                : "Vybrat soubor"}
            </div>
          </Button>
        </Label>
      </div>
      
      {documentType !== "other" && (
        <p className="text-xs text-muted-foreground">
          Data budou automaticky načtena z dokumentu pomocí OCR
        </p>
      )}
    </div>
  );
}
