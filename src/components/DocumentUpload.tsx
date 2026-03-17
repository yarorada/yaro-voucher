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
import { compressImage, isImageFile, formatBytes } from "@/lib/imageCompression";

interface DocumentUploadProps {
  clientId: string;
  documentType: "passport" | "id_card" | "other";
  onDataExtracted?: (data: any) => void;
  onUploadComplete?: (url: string) => void;
  allowMultiple?: boolean;
  autoSaveToClient?: boolean;
}

interface UploadingFile {
  file: File;
  status: "uploading" | "processing" | "success" | "error" | "compressing";
  progress: number;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
  savings?: number;
}

export function DocumentUpload({
  clientId,
  documentType,
  onDataExtracted,
  onUploadComplete,
  allowMultiple = true,
  autoSaveToClient = false,
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

      // Validate file type (including HEIC/HEIF from iPhone)
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isHeic = ext === "heic" || ext === "heif";
      if (!allowedTypes.includes(file.type) && !isHeic) {
        toast.error(`${file.name}: Nepodporovaný formát. Použijte JPG, PNG, WEBP, HEIC nebo PDF.`);
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
      let fileToUpload = file;
      let originalSize = file.size;
      let compressedSize = file.size;
      let savings = 0;

      // Compress image files before upload
      if (isImageFile(file)) {
        setUploadingFiles(prev => 
          prev.map((uf, i) => i === index ? { 
            ...uf, 
            status: "compressing",
            progress: 10,
            originalSize: file.size 
          } : uf)
        );

        try {
          const compressed = await compressImage(file, 1920, 1920, 0.85);
          
          // Only use compressed version if it's actually smaller
          if (compressed.compressedSize < file.size) {
            fileToUpload = new File([compressed.blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            originalSize = compressed.originalSize;
            compressedSize = compressed.compressedSize;
            savings = compressed.savings;
            
            toast.success(`Obrázek zkomprimován o ${savings}%`);
          } else {
            // Original is smaller, use it
            toast.info("Komprese nepřinesla úsporu, použit originál");
          }
        } catch (compressionError) {
          console.error("Compression error:", compressionError);
          toast.warning("Komprese selhala, nahrávám originál");
        }
      }

      // Update progress
      setUploadingFiles(prev => 
        prev.map((uf, i) => i === index ? { 
          ...uf, 
          status: "uploading",
          progress: 30,
          originalSize,
          compressedSize,
          savings 
        } : uf)
      );

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(fileName, fileToUpload);

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
      if (fileToUpload.type.startsWith("image/") && documentType !== "other") {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(fileToUpload);
        });

        // Call OCR function with retry logic for rate limiting
        let ocrData = null;
        let ocrError = null;
        const maxRetries = 3;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const result = await supabase.functions.invoke(
            "ocr-document",
            {
              body: {
                imageBase64: base64,
                documentType: documentType,
              },
            }
          );
          
          // Check if rate limited
          if (result.error?.message?.includes("429") || result.data?.error?.includes("Rate limit")) {
            if (attempt < maxRetries - 1) {
              // Wait with exponential backoff: 2s, 4s, 8s
              const waitTime = Math.pow(2, attempt + 1) * 1000;
              console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 2}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          ocrData = result.data;
          ocrError = result.error;
          break;
        }

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
          console.log("OCR data extracted:", ocrData.data);
          
          // Call the callback for UI updates
          onDataExtracted?.(ocrData.data);
          
          // Auto-save to client if enabled
          if (autoSaveToClient) {
            try {
              const updateData: any = {};
              
              // Parse date from DD.MM.YY format to ISO date string
              const parseDate = (dateStr: string, isBirthDate: boolean = false): string | null => {
                if (!dateStr) return null;
                const parts = dateStr.split('.');
                if (parts.length !== 3) return null;
                
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                let year = parseInt(parts[2]);
                
                // Convert 2-digit year to 4-digit year
                if (year < 100) {
                  if (isBirthDate) {
                    // For birth dates: 00-29 = 2000-2029, 30-99 = 1930-1999
                    year += year < 30 ? 2000 : 1900;
                  } else {
                    // For expiry dates: always assume 2000+
                    year += 2000;
                  }
                }
                
                // Use Date.UTC to avoid timezone issues
                const date = new Date(Date.UTC(year, month - 1, day));
                return date.toISOString().split('T')[0];
              };
              
              if (documentType === "passport") {
                if (ocrData.data.passport_number) {
                  updateData.passport_number = ocrData.data.passport_number;
                }
                if (ocrData.data.passport_expiry || ocrData.data.expiry_date) {
                  const parsed = parseDate(ocrData.data.passport_expiry || ocrData.data.expiry_date, false);
                  if (parsed) updateData.passport_expiry = parsed;
                }
                if (ocrData.data.first_name) {
                  updateData.first_name = ocrData.data.first_name;
                }
                if (ocrData.data.last_name) {
                  updateData.last_name = ocrData.data.last_name;
                }
                if (ocrData.data.date_of_birth) {
                  const parsed = parseDate(ocrData.data.date_of_birth, true);
                  if (parsed) updateData.date_of_birth = parsed;
                }
              } else if (documentType === "id_card") {
                if (ocrData.data.id_card_number) {
                  updateData.id_card_number = ocrData.data.id_card_number;
                }
                if (ocrData.data.id_card_expiry || ocrData.data.expiry_date) {
                  const parsed = parseDate(ocrData.data.id_card_expiry || ocrData.data.expiry_date, false);
                  if (parsed) updateData.id_card_expiry = parsed;
                }
                if (ocrData.data.first_name) {
                  updateData.first_name = ocrData.data.first_name;
                }
                if (ocrData.data.last_name) {
                  updateData.last_name = ocrData.data.last_name;
                }
                if (ocrData.data.date_of_birth) {
                  const parsed = parseDate(ocrData.data.date_of_birth, true);
                  if (parsed) updateData.date_of_birth = parsed;
                }
              }
              
              // Update client in database if we have data
              if (Object.keys(updateData).length > 0) {
                console.log("Updating client with OCR data:", updateData);
                
                const { error: updateError } = await supabase
                  .from("clients")
                  .update(updateData as any)
                  .eq("id", clientId);
                
                if (updateError) {
                  console.error("Failed to update client:", updateError);
                  toast.error("Nepodařilo se uložit data z dokumentu");
                } else {
                  console.log("Client updated successfully");
                  toast.success("Data z dokumentu byla úspěšně uložena");
                  // Trigger refresh to show updated data
                  onUploadComplete?.(documentUrl);
                }
              }
            } catch (saveError) {
              console.error("Error saving OCR data:", saveError);
            }
          }
          
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
          Podporované formáty: JPG, PNG, WEBP, HEIC, PDF (max 20MB)
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
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {uploadingFile.originalSize && uploadingFile.compressedSize ? (
                          <>
                            <span>{formatBytes(uploadingFile.originalSize)}</span>
                            <span>→</span>
                            <span className="text-green-600 font-medium">
                              {formatBytes(uploadingFile.compressedSize)}
                            </span>
                            {uploadingFile.savings > 0 && (
                              <span className="text-green-600 font-medium">
                                (-{uploadingFile.savings}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span>{formatBytes(uploadingFile.file.size)}</span>
                        )}
                      </div>
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
                      {uploadingFile.status === "compressing" && "Komprimuji obrázek..."}
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
