import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  passport_number?: string;
  passport_expiry?: string;
  id_card_number?: string;
  id_card_expiry?: string;
}

interface UploadStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  extractedData?: ExtractedData;
  error?: string;
}

export const BulkClientUpload = ({ onComplete }: { onComplete: () => void }) => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File): Promise<ExtractedData> => {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Determine document type from filename
    const filename = file.name.toLowerCase();
    const documentType = filename.includes('pas') ? 'passport' : 'id_card';

    // Call OCR function
    const { data, error } = await supabase.functions.invoke('ocr-document', {
      body: { imageBase64: base64, documentType }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'OCR failed');

    return data.data;
  };

  const createClient = async (extractedData: ExtractedData) => {
    // Parse dates
    const parseDateDDMMYY = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const [day, month, year] = dateStr.split('.');
      if (!day || !month || !year) return null;
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      return new Date(Date.UTC(parseInt(fullYear), parseInt(month) - 1, parseInt(day))).toISOString().split('T')[0];
    };

    const clientData: any = {
      first_name: extractedData.first_name || '',
      last_name: extractedData.last_name || '',
      date_of_birth: parseDateDDMMYY(extractedData.date_of_birth),
    };

    if (extractedData.passport_number) {
      clientData.passport_number = extractedData.passport_number;
      clientData.passport_expiry = parseDateDDMMYY(extractedData.passport_expiry);
    }

    if (extractedData.id_card_number) {
      clientData.id_card_number = extractedData.id_card_number;
      clientData.id_card_expiry = parseDateDDMMYY(extractedData.id_card_expiry);
    }

    const { error } = await supabase.from('clients').insert(clientData);
    if (error) throw error;
  };

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    const newUploads: UploadStatus[] = fileArray.map(file => ({
      file,
      status: 'pending' as const
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Process each file
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const uploadIndex = uploads.length + i;

      setUploads(prev => {
        const updated = [...prev];
        updated[uploadIndex] = { ...updated[uploadIndex], status: 'processing' };
        return updated;
      });

      try {
        const extractedData = await processFile(file);
        
        // Check for required fields
        if (!extractedData.first_name || !extractedData.last_name) {
          throw new Error('Nepodařilo se extrahovat jméno a příjmení');
        }

        await createClient(extractedData);

        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { 
            ...updated[uploadIndex], 
            status: 'success',
            extractedData 
          };
          return updated;
        });
      } catch (error: any) {
        console.error('Error processing file:', error);
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { 
            ...updated[uploadIndex], 
            status: 'error',
            error: error.message 
          };
          return updated;
        });
      }
    }

    // Show summary
    const successCount = fileArray.filter((_, i) => {
      const upload = uploads[uploads.length + i];
      return upload?.status === 'success';
    }).length;

    if (successCount > 0) {
      toast.success(`Přidáno ${successCount} klientů`);
      onComplete();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [uploads]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        className={`p-8 border-2 border-dashed transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Upload className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Přetáhněte dokumenty sem
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Nebo klikněte pro výběr souborů
            </p>
            <input
              type="file"
              id="bulk-upload"
              className="hidden"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileInput}
            />
            <Button asChild variant="outline">
              <label htmlFor="bulk-upload" className="cursor-pointer">
                Vybrat soubory
              </label>
            </Button>
          </div>
        </div>
      </Card>

      {uploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Zpracování dokumentů</h4>
          {uploads.map((upload, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  {upload.extractedData && (
                    <p className="text-xs text-muted-foreground">
                      {upload.extractedData.first_name} {upload.extractedData.last_name}
                    </p>
                  )}
                  {upload.error && (
                    <p className="text-xs text-destructive">{upload.error}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {upload.status === 'pending' && (
                    <div className="h-5 w-5 rounded-full bg-muted" />
                  )}
                  {upload.status === 'processing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {upload.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
