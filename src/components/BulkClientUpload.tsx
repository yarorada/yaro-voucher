import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileText, CheckCircle, XCircle, Loader2, CalendarIcon, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ExtractedData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  passport_number?: string;
  passport_expiry?: string;
  id_card_number?: string;
  id_card_expiry?: string;
  documentType?: 'passport' | 'id_card';
  title?: string;
}

interface UploadStatus {
  file: File;
  status: 'pending' | 'processing' | 'preview' | 'success' | 'error';
  extractedData?: ExtractedData;
  compressedBlob?: Blob;
  error?: string;
}

export const BulkClientUpload = ({ onComplete }: { onComplete: () => void }) => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);

  const processFile = async (file: File): Promise<{ extractedData: ExtractedData; compressedBlob: Blob }> => {
    // Compress image first to reduce size for AI gateway
    const { blob } = await compressImage(file, 1920, 1920, 0.8);
    
    // Convert compressed blob to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    // Try both document types to find which one has data
    let extractedData: ExtractedData | null = null;
    let documentType: 'passport' | 'id_card' = 'passport';

    // First try passport
    const { data: passportData } = await supabase.functions.invoke('ocr-document', {
      body: { imageBase64: base64, documentType: 'passport' }
    });

    if (passportData?.success && passportData.data?.passport_number) {
      extractedData = { ...passportData.data, documentType: 'passport' };
    } else {
      // Try ID card
      const { data: idCardData } = await supabase.functions.invoke('ocr-document', {
        body: { imageBase64: base64, documentType: 'id_card' }
      });
      
      if (idCardData?.success && idCardData.data?.id_card_number) {
        extractedData = { ...idCardData.data, documentType: 'id_card' };
      } else if (passportData?.success) {
        // Use passport data even if no number found
        extractedData = { ...passportData.data, documentType: 'passport' };
      } else if (idCardData?.success) {
        extractedData = { ...idCardData.data, documentType: 'id_card' };
      }
    }

    if (!extractedData) {
      throw new Error('OCR selhalo - nepodařilo se extrahovat data');
    }

    return { extractedData, compressedBlob: blob };
  };

  const createClient = async (extractedData: ExtractedData, file: File, compressedBlob: Blob) => {
    // Parse dates - handle both formats DD.MM.YY and DD.MM.YYYY
    const parseDateDDMMYY = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      
      // Remove any non-digit and non-dot characters
      const cleaned = dateStr.replace(/[^\d.]/g, '');
      const parts = cleaned.split('.');
      
      if (parts.length !== 3) return null;
      
      const day = parts[0];
      const month = parts[1];
      let year = parts[2];
      
      if (!day || !month || !year) return null;
      
      // Handle 2-digit year
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum < 50 ? `20${year}` : `19${year}`;
      }
      
      return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day))).toISOString().split('T')[0];
    };

    const clientData: any = {
      first_name: extractedData.first_name || '',
      last_name: extractedData.last_name || '',
      date_of_birth: parseDateDDMMYY(extractedData.date_of_birth),
      title: extractedData.title || null,
    };

    if (extractedData.passport_number) {
      clientData.passport_number = extractedData.passport_number;
      clientData.passport_expiry = parseDateDDMMYY(extractedData.passport_expiry);
    }

    if (extractedData.id_card_number) {
      clientData.id_card_number = extractedData.id_card_number;
      clientData.id_card_expiry = parseDateDDMMYY(extractedData.id_card_expiry);
    }

    // Insert client first
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();
    
    if (insertError) throw insertError;

    // Upload document to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${newClient.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, compressedBlob, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('client-documents')
      .getPublicUrl(filePath);

    // Create document URL object
    const documentUrl = {
      url: publicUrl,
      type: extractedData.documentType || 'passport',
      fileName: file.name,
      uploadedAt: new Date().toISOString()
    };

    // Get existing document_urls using raw query
    const { data: existingClient }: any = await supabase
      .from('clients')
      .select('document_urls')
      .eq('id', newClient.id)
      .single();

    const existingUrls = existingClient?.document_urls || [];

    // Update client with document URL
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        document_urls: [...existingUrls, documentUrl]
      } as any)
      .eq('id', newClient.id);

    if (updateError) throw updateError;
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
        const { extractedData, compressedBlob } = await processFile(file);
        
        // Check for required fields
        if (!extractedData.first_name || !extractedData.last_name) {
          throw new Error('Nepodařilo se extrahovat jméno a příjmení');
        }

        // Set status to preview and wait for user confirmation
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { 
            ...updated[uploadIndex], 
            status: 'preview',
            extractedData,
            compressedBlob
          };
          return updated;
        });

        // Show preview for first pending item
        if (previewIndex === null) {
          setPreviewIndex(uploadIndex);
          // Automatically set title based on first name
          const autoTitle = extractedData.first_name?.toLowerCase().endsWith('a') ? 'Paní' : 'Pan';
          setEditedData({ ...extractedData, title: autoTitle });
        }
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
  };

  const handleConfirmPreview = async () => {
    if (previewIndex === null || !editedData) return;

    const upload = uploads[previewIndex];
    if (!upload.compressedBlob) return;

    setUploads(prev => {
      const updated = [...prev];
      updated[previewIndex] = { ...updated[previewIndex], status: 'processing' };
      return updated;
    });

    try {
      await createClient(editedData, upload.file, upload.compressedBlob);
      
      setUploads(prev => {
        const updated = [...prev];
        updated[previewIndex] = { 
          ...updated[previewIndex], 
          status: 'success',
          extractedData: editedData
        };
        return updated;
      });

      toast.success('Klient úspěšně vytvořen');

      // Find next preview item
      const nextPreviewIndex = uploads.findIndex((u, i) => i > previewIndex && u.status === 'preview');
      if (nextPreviewIndex !== -1) {
        setPreviewIndex(nextPreviewIndex);
        const nextData = uploads[nextPreviewIndex].extractedData;
        if (nextData) {
          const autoTitle = nextData.first_name?.toLowerCase().endsWith('a') ? 'Paní' : 'Pan';
          setEditedData({ ...nextData, title: autoTitle });
        }
      } else {
        setPreviewIndex(null);
        setEditedData(null);
      }
    } catch (error: any) {
      console.error('Error creating client:', error);
      setUploads(prev => {
        const updated = [...prev];
        updated[previewIndex] = { 
          ...updated[previewIndex], 
          status: 'error',
          error: error.message 
        };
        return updated;
      });
      toast.error('Chyba při vytváření klienta: ' + error.message);
    }
  };

  const handleSkipPreview = () => {
    if (previewIndex === null) return;

    setUploads(prev => {
      const updated = [...prev];
      updated[previewIndex] = { 
        ...updated[previewIndex], 
        status: 'error',
        error: 'Přeskočeno uživatelem'
      };
      return updated;
    });

    // Find next preview item
    const nextPreviewIndex = uploads.findIndex((u, i) => i > previewIndex && u.status === 'preview');
    if (nextPreviewIndex !== -1) {
      setPreviewIndex(nextPreviewIndex);
      const nextData = uploads[nextPreviewIndex].extractedData;
      if (nextData) {
        const autoTitle = nextData.first_name?.toLowerCase().endsWith('a') ? 'Paní' : 'Pan';
        setEditedData({ ...nextData, title: autoTitle });
      }
    } else {
      setPreviewIndex(null);
      setEditedData(null);
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
                  {upload.status === 'preview' && (
                    <Eye className="h-5 w-5 text-blue-500" />
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

      {/* Preview Dialog */}
      <Dialog open={previewIndex !== null} onOpenChange={(open) => {
        if (!open) {
          handleSkipPreview();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zkontrolujte extrahovaná data</DialogTitle>
            <DialogDescription>
              Upravte data dle potřeby před uložením do databáze
            </DialogDescription>
          </DialogHeader>

          {editedData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titul</Label>
                  <Select
                    value={editedData.title || ''}
                    onValueChange={(value) => setEditedData({ ...editedData, title: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte titul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pan">Pan</SelectItem>
                      <SelectItem value="Paní">Paní</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Jméno *</Label>
                  <Input
                    id="first_name"
                    value={editedData.first_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Příjmení *</Label>
                  <Input
                    id="last_name"
                    value={editedData.last_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Datum narození</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editedData.date_of_birth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editedData.date_of_birth ? (
                        format(new Date(editedData.date_of_birth.split('.').reverse().join('-')), "d. MMMM yyyy", { locale: cs })
                      ) : (
                        <span>Vyberte datum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editedData.date_of_birth ? new Date(editedData.date_of_birth.split('.').reverse().join('-')) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const formatted = format(date, "dd.MM.yy");
                          setEditedData({ ...editedData, date_of_birth: formatted });
                        }
                      }}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {editedData.documentType === 'passport' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passport_number">Číslo pasu</Label>
                      <Input
                        id="passport_number"
                        value={editedData.passport_number || ''}
                        onChange={(e) => setEditedData({ ...editedData, passport_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platnost pasu</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editedData.passport_expiry && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editedData.passport_expiry ? (
                              format(new Date(editedData.passport_expiry.split('.').reverse().join('-')), "d. MMMM yyyy", { locale: cs })
                            ) : (
                              <span>Vyberte datum</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editedData.passport_expiry ? new Date(editedData.passport_expiry.split('.').reverse().join('-')) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const formatted = format(date, "dd.MM.yy");
                                setEditedData({ ...editedData, passport_expiry: formatted });
                              }
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </>
              )}

              {editedData.documentType === 'id_card' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="id_card_number">Číslo občanského průkazu</Label>
                      <Input
                        id="id_card_number"
                        value={editedData.id_card_number || ''}
                        onChange={(e) => setEditedData({ ...editedData, id_card_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platnost OP</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editedData.id_card_expiry && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editedData.id_card_expiry ? (
                              format(new Date(editedData.id_card_expiry.split('.').reverse().join('-')), "d. MMMM yyyy", { locale: cs })
                            ) : (
                              <span>Vyberte datum</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editedData.id_card_expiry ? new Date(editedData.id_card_expiry.split('.').reverse().join('-')) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const formatted = format(date, "dd.MM.yy");
                                setEditedData({ ...editedData, id_card_expiry: formatted });
                              }
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleSkipPreview}>
              Přeskočit
            </Button>
            <Button onClick={handleConfirmPreview}>
              Potvrdit a uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
