import { useState, useRef, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Upload, FileText, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  clientId: string;
  documentType: "passport" | "id_card" | "other";
  onDataExtracted?: (data: any) => void;
  onUploadComplete?: (url: string) => void;
  allowMultiple?: boolean;
}

interface UploadingFile {
  file: File;
  status: "uploading" | "processing" | "success" | "error";
  progress: number;
  error?: string;
}

export function DocumentUpload({
  clientId,
  documentType,
  onDataExtracted,
  onUploadComplete,
  allowMultiple = true,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    handleFiles(Array.from(files));
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    // Validate files
    const validFiles: File[] = [];
    
    for (const file of files) {
      // Validate file size (20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: Soubor je příliš velký. Maximální velikost je 20MB.`);
        continue;
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Nepodporovaný formát. Použijte JPG, PNG, WEBP nebo PDF.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Add files to uploading state
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      status: "uploading",
      progress: 0,
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files one by one
    for (let i = 0; i < validFiles.length; i++) {
      await uploadFile(validFiles[i], uploadingFiles.length + i);
    }
  };

  const uploadFile = async (file: File, index: number) => {
    try {
      // Update progress
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { ...uf, progress: 30 } : uf)
      );

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update progress
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { ...uf, progress: 60 } : uf)
      );

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("client-documents")
        .getPublicUrl(fileName);

      const documentUrl = urlData.publicUrl;

      // Update progress
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { ...uf, status: "processing", progress: 70 } : uf)
      );

      // If it's an image and we have a document type, process with OCR
      if (file.type.startsWith("image/") && documentType !== "other") {
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
          setUploadingFiles(prev => 
            prev.map((uf, i) => i === index ? { 
              ...uf, 
              status: "error", 
              progress: 100,
              error: "OCR se nezdařilo" 
            } : uf)
          );
        } else if (ocrData?.data) {
          onDataExtracted?.(ocrData.data);
          setUploadingFiles(prev => 
            prev.map((uf, i) => i === index ? { ...uf, progress: 90 } : uf)
          );
        }
      }

      // Update client with document URL
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("document_urls")
        .eq("id", clientId)
        .single();

      if (!clientError && clientData) {
        const currentUrls = Array.isArray((clientData as any).document_urls) ? (clientData as any).document_urls : [];
        const newUrls = [...currentUrls, { 
          url: documentUrl, 
          type: documentType, 
          uploadedAt: new Date().toISOString(),
          fileName: file.name 
        }];
        
        await supabase
          .from("clients")
          .update({ document_urls: newUrls } as any)
          .eq("id", clientId);
      }

      // Mark as success
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { ...uf, status: "success", progress: 100 } : uf)
      );
      
      onUploadComplete?.(documentUrl);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { 
          ...uf, 
          status: "error", 
          progress: 100,
          error: error instanceof Error ? error.message : "Neznámá chyba"
        } : uf)
      );
    }
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
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
    <div className="space-y-4">
      <Label>{getLabel()}</Label>
      
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={cn(
          "h-12 w-12 mx-auto mb-4",
          isDragging ? "text-primary" : "text-muted-foreground"
        )} />
        <p className="text-sm font-medium mb-1">
          {isDragging ? "Pusťte soubory zde" : "Přetáhněte soubory sem"}
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          nebo klikněte pro výběr souborů
        </p>
        <p className="text-xs text-muted-foreground">
          Podporované formáty: JPG, PNG, WEBP, PDF (max 20MB)
        </p>
        {documentType !== "other" && (
          <p className="text-xs text-muted-foreground mt-2">
            Data budou automaticky načtena z dokumentu pomocí OCR
          </p>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileSelect}
        multiple={allowMultiple}
        className="hidden"
      />

      {/* Uploading Files Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadingFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {uploadingFile.status === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {uploadingFile.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {uploadingFile.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {uploadingFile.status === "processing" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeUploadingFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Progress value={uploadingFile.progress} className="h-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {uploadingFile.status === "uploading" && "Nahrávám..."}
                      {uploadingFile.status === "processing" && "Zpracovávám OCR..."}
                      {uploadingFile.status === "success" && "Dokončeno"}
                      {uploadingFile.status === "error" && (uploadingFile.error || "Chyba")}
                    </span>
                    <span className="text-muted-foreground">
                      {uploadingFile.progress}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
