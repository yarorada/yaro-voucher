import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileText, CheckCircle, XCircle, Loader2, CalendarIcon, Eye, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn, removeDiacritics } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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
  status: 'pending' | 'compressing' | 'uploading' | 'processing' | 'preview' | 'success' | 'error';
  extractedData?: ExtractedData;
  compressedBlob?: Blob;
  error?: string;
  progress?: number;
  ocrFilledFields?: Set<string>;
}

interface DuplicateClient {
  id: string;
  first_name: string;
  last_name: string;
  passport_number?: string;
  id_card_number?: string;
}

export const BulkClientUpload = ({ onComplete }: { onComplete: () => void }) => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    show: boolean;
    existingClient: DuplicateClient | null;
    newData: ExtractedData | null;
    file: File | null;
    blob: Blob | null;
  }>({
    show: false,
    existingClient: null,
    newData: null,
    file: null,
    blob: null
  });

  // Helper function to parse DD.MM.YY or DD.MM.YYYY dates safely
  const parseDateDDMMYY = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    try {
      const parts = dateStr.trim().split('.');
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      // Validate basic ranges
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (day < 1 || day > 31 || month < 1 || month > 12) return null;
      
      // Convert 2-digit year to 4-digit year
      if (year < 100) {
        // For birth dates (past): 00-29 → 2000-2029, 30-99 → 1930-1999
        // But this is ambiguous, so we rely on OCR returning 4-digit years now
        year += year < 30 ? 2000 : 1900;
      }
      
      const date = new Date(year, month - 1, day);
      
      // Validate the date is valid
      if (isNaN(date.getTime())) return null;
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return null;
      }
      
      return date;
    } catch (error) {
      console.error("Error parsing date:", error);
      return null;
    }
  };


  const processFile = async (file: File, index: number): Promise<{ extractedData: ExtractedData; compressedBlob: Blob }> => {
    const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
    let blob: Blob;
    
    if (isImage) {
      // Update status to compressing only for images
      setUploads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'compressing', progress: 10 };
        return updated;
      });

      // Compress image first to reduce size for AI gateway
      const result = await compressImage(file, 1920, 1920, 0.8);
      blob = result.blob;
    } else {
      // For PDF files, use the original file
      blob = file;
    }
    
    // Update status to uploading (converting to base64)
    setUploads(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: 'uploading', progress: 30 };
      return updated;
    });

    // Convert blob to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    // Update status to processing (OCR)
    setUploads(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: 'processing', progress: 50 };
      return updated;
    });

    // Try both document types to find which one has data
    let extractedData: ExtractedData | null = null;
    let documentType: 'passport' | 'id_card' = 'passport';

    console.log('Trying passport OCR...');
    // First try passport
    const { data: passportData } = await supabase.functions.invoke('ocr-document', {
      body: { imageBase64: base64, documentType: 'passport' }
    });

    console.log('Passport OCR response:', passportData);

    if (passportData?.success && passportData.data?.passport_number) {
      console.log('Found passport number:', passportData.data.passport_number);
      extractedData = { ...passportData.data, documentType: 'passport' };
    } else {
      console.log('Trying ID card OCR...');
      // Try ID card
      const { data: idCardData } = await supabase.functions.invoke('ocr-document', {
        body: { imageBase64: base64, documentType: 'id_card' }
      });
      
      console.log('ID card OCR response:', idCardData);
      
      if (idCardData?.success && idCardData.data?.id_card_number) {
        console.log('Found ID card number:', idCardData.data.id_card_number);
        extractedData = { ...idCardData.data, documentType: 'id_card' };
      } else if (passportData?.success) {
        console.log('Using passport data without number');
        // Use passport data even if no number found
        extractedData = { ...passportData.data, documentType: 'passport' };
      } else if (idCardData?.success) {
        console.log('Using ID card data without number');
        extractedData = { ...idCardData.data, documentType: 'id_card' };
      }
    }

    if (!extractedData) {
      throw new Error('OCR selhalo - nepodařilo se extrahovat data');
    }

    console.log('OCR extracted data:', extractedData);

    // Determine which fields were filled by OCR
    const ocrFilledFields = new Set<string>();
    if (extractedData.first_name) ocrFilledFields.add('first_name');
    if (extractedData.last_name) ocrFilledFields.add('last_name');
    if (extractedData.date_of_birth) ocrFilledFields.add('date_of_birth');
    if (extractedData.passport_number) ocrFilledFields.add('passport_number');
    if (extractedData.passport_expiry) ocrFilledFields.add('passport_expiry');
    if (extractedData.id_card_number) ocrFilledFields.add('id_card_number');
    if (extractedData.id_card_expiry) ocrFilledFields.add('id_card_expiry');

    // Update to preview with OCR filled fields
    setUploads(prev => {
      const updated = [...prev];
      updated[index] = { 
        ...updated[index], 
        status: 'preview', 
        progress: 100,
        extractedData,
        compressedBlob: blob,
        ocrFilledFields
      };
      return updated;
    });

    return { extractedData, compressedBlob: blob };
  };

  const checkForDuplicate = async (extractedData: ExtractedData): Promise<DuplicateClient | null> => {
    try {
      // Fetch all clients once for local comparison with diacritics normalization
      const { data: allClients, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, passport_number, id_card_number');
      
      if (error || !allClients) {
        console.error('Error fetching clients:', error);
        return null;
      }

      // Check by passport number first (exact match)
      if (extractedData.passport_number) {
        const matchByPassport = allClients.find(client => 
          client.passport_number === extractedData.passport_number
        );
        if (matchByPassport) return matchByPassport as DuplicateClient;
      }

      // Check by ID card number (exact match)
      if (extractedData.id_card_number) {
        const matchByIdCard = allClients.find(client => 
          client.id_card_number === extractedData.id_card_number
        );
        if (matchByIdCard) return matchByIdCard as DuplicateClient;
      }

      // Check by name with diacritics normalization
      if (extractedData.first_name && extractedData.last_name) {
        const normalizedFirstName = removeDiacritics(extractedData.first_name.trim().toLowerCase());
        const normalizedLastName = removeDiacritics(extractedData.last_name.trim().toLowerCase());
        
        const matchByName = allClients.find(client => 
          removeDiacritics(client.first_name.toLowerCase()) === normalizedFirstName &&
          removeDiacritics(client.last_name.toLowerCase()) === normalizedLastName
        );
        if (matchByName) return matchByName as DuplicateClient;
      }

      return null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null;
    }
  };

  const updateExistingClient = async (clientId: string, extractedData: ExtractedData, file: File, compressedBlob: Blob) => {
    // Parse dates - handle both formats DD.MM.YY and DD.MM.YYYY
    const parseDateToDBFormat = (dateStr: string | undefined): string | null => {
      if (!dateStr) return null;
      
      const cleaned = dateStr.replace(/[^\d.]/g, '');
      const parts = cleaned.split('.');
      
      if (parts.length !== 3) return null;
      
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parseInt(parts[2], 10);
      
      if (isNaN(year)) return null;
      
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      
      return `${year}-${month}-${day}`;
    };

    // Get existing client data
    const { data: existingClient }: any = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!existingClient) throw new Error('Klient nenalezen');

    // Merge data - only update fields that have new values
    const updateData: any = {};
    
    if (extractedData.title && !existingClient.title) {
      updateData.title = extractedData.title;
    }
    
    if (extractedData.date_of_birth && !existingClient.date_of_birth) {
      updateData.date_of_birth = parseDateToDBFormat(extractedData.date_of_birth);
    }
    
    if (extractedData.passport_number && !existingClient.passport_number) {
      updateData.passport_number = extractedData.passport_number;
    }
    
    if (extractedData.passport_expiry && !existingClient.passport_expiry) {
      updateData.passport_expiry = parseDateToDBFormat(extractedData.passport_expiry);
    }
    
    if (extractedData.id_card_number && !existingClient.id_card_number) {
      updateData.id_card_number = extractedData.id_card_number;
    }
    
    if (extractedData.id_card_expiry && !existingClient.id_card_expiry) {
      updateData.id_card_expiry = parseDateToDBFormat(extractedData.id_card_expiry);
    }

    // Update client if there are changes
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (updateError) throw updateError;
    }

    // Upload document
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `${clientId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, compressedBlob, {
        contentType: file.type,
        cacheControl: '3600',
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

    // Get existing document_urls
    const { data: clientWithDocs }: any = await supabase
      .from('clients')
      .select('document_urls')
      .eq('id', clientId)
      .single();

    const existingUrls = clientWithDocs?.document_urls || [];

    // Update client with document URL
    const { error: docUpdateError } = await supabase
      .from('clients')
      .update({
        document_urls: [...existingUrls, documentUrl]
      } as any)
      .eq('id', clientId);

    if (docUpdateError) throw docUpdateError;
  };

  const createClient = async (extractedData: ExtractedData, file: File, compressedBlob: Blob) => {
    // Parse dates - handle both formats DD.MM.YY and DD.MM.YYYY
    const parseDateToDBFormat2 = (dateStr: string | undefined): string | null => {
      if (!dateStr) return null;
      
      const cleaned = dateStr.replace(/[^\d.]/g, '');
      const parts = cleaned.split('.');
      
      if (parts.length !== 3) return null;
      
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parseInt(parts[2], 10);
      
      if (isNaN(year)) return null;
      
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      
      return `${year}-${month}-${day}`;
    };

    const clientData: any = {
      first_name: extractedData.first_name || '',
      last_name: extractedData.last_name || '',
      date_of_birth: parseDateToDBFormat2(extractedData.date_of_birth),
      title: extractedData.title || null,
    };

    console.log('Creating client with data:', clientData);

    // Add passport data if either number or expiry exists
    if (extractedData.passport_number || extractedData.passport_expiry) {
      console.log('Adding passport data:', extractedData.passport_number, extractedData.passport_expiry);
      if (extractedData.passport_number) {
        clientData.passport_number = extractedData.passport_number;
      }
      if (extractedData.passport_expiry) {
        clientData.passport_expiry = parseDateToDBFormat2(extractedData.passport_expiry);
      }
    }

    // Add ID card data if either number or expiry exists
    if (extractedData.id_card_number || extractedData.id_card_expiry) {
      console.log('Adding ID card data:', extractedData.id_card_number, extractedData.id_card_expiry);
      if (extractedData.id_card_number) {
        clientData.id_card_number = extractedData.id_card_number;
      }
      if (extractedData.id_card_expiry) {
        clientData.id_card_expiry = parseDateToDBFormat2(extractedData.id_card_expiry);
      }
    }

    console.log('Final client data before insert:', clientData);

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
    const baseIndex = uploads.length;
    const newUploads: UploadStatus[] = fileArray.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Process each file
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const uploadIndex = baseIndex + i;

      try {
        await processFile(file, uploadIndex);
      } catch (error: any) {
        console.error('Error processing file:', error);
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { 
            ...updated[uploadIndex], 
            status: 'error',
            error: error.message,
            progress: 100
          };
          return updated;
        });
        toast.error(`Chyba: ${error.message}`);
      }
    }

    // After all files are processed, open preview for first one
    setTimeout(() => {
      setUploads(prev => {
        const firstPreviewIndex = prev.findIndex(u => u.status === 'preview');
        if (firstPreviewIndex !== -1) {
          setPreviewIndex(firstPreviewIndex);
          const firstData = prev[firstPreviewIndex].extractedData;
          if (firstData) {
            const autoTitle = firstData.first_name?.toLowerCase().endsWith('a') ? 'Paní' : 'Pan';
            setEditedData({ ...firstData, title: autoTitle });
          }
        }
        return prev;
      });
    }, 100);
  };

  const handleConfirmPreview = async () => {
    if (previewIndex === null || !editedData) return;

    const upload = uploads[previewIndex];
    if (!upload.compressedBlob) return;

    // Check for duplicates first
    try {
      const duplicate = await checkForDuplicate(editedData);
      
      if (duplicate) {
        // Show duplicate dialog
        setDuplicateDialog({
          show: true,
          existingClient: duplicate,
          newData: editedData,
          file: upload.file,
          blob: upload.compressedBlob
        });
        return; // Don't proceed with creation
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      toast.error('Chyba při kontrole duplicit');
      return;
    }

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
        
        // Check if all uploads are completed after this update
        const allCompleted = updated.every(u => u.status === 'success' || u.status === 'error');
        const successCount = updated.filter(u => u.status === 'success').length;
        
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
        // No more previews - check completion and close
        setPreviewIndex(null);
        setEditedData(null);
        
        // Get updated uploads state to check completion
        setUploads(prev => {
          const allCompleted = prev.every(u => u.status === 'success' || u.status === 'error');
          const successCount = prev.filter(u => u.status === 'success').length;
          
          if (allCompleted && successCount > 0) {
            // Small delay to ensure state updates are complete
            setTimeout(() => {
              onComplete();
            }, 100);
          }
          
          return prev;
        });
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
      // No more previews - check completion and close
      setPreviewIndex(null);
      setEditedData(null);
      
      // Get updated uploads state to check completion
      setUploads(prev => {
        const allCompleted = prev.every(u => u.status === 'success' || u.status === 'error');
        const successCount = prev.filter(u => u.status === 'success').length;
        
        if (allCompleted && successCount > 0) {
          // Small delay to ensure state updates are complete
          setTimeout(() => {
            onComplete();
          }, 100);
        }
        
        return prev;
      });
    }
  };

  const handleConfirmAll = async () => {
    setIsBatchProcessing(true);
    setPreviewIndex(null);
    setEditedData(null);

    // Get all preview items
    const previewItems = uploads
      .map((upload, index) => ({ upload, index }))
      .filter(({ upload }) => upload.status === 'preview');

    let successCount = 0;
    let errorCount = 0;

    for (const { upload, index } of previewItems) {
      if (!upload.extractedData || !upload.compressedBlob) continue;

      setUploads(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'processing' };
        return updated;
      });

      try {
        // Auto-assign title
        const autoTitle = upload.extractedData.first_name?.toLowerCase().endsWith('a') ? 'Paní' : 'Pan';
        const dataWithTitle = { ...upload.extractedData, title: autoTitle };

        await createClient(dataWithTitle, upload.file, upload.compressedBlob);
        
        setUploads(prev => {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            status: 'success',
            extractedData: dataWithTitle
          };
          return updated;
        });
        
        successCount++;
      } catch (error: any) {
        console.error('Error creating client:', error);
        setUploads(prev => {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            status: 'error',
            error: error.message 
          };
          return updated;
        });
        errorCount++;
      }
    }

    setIsBatchProcessing(false);

    // Show summary
    if (successCount > 0) {
      toast.success(`Úspěšně vytvořeno ${successCount} klientů`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} klientů se nepodařilo vytvořit`);
    }

    // Close dialog and refresh if any succeeded
    if (successCount > 0) {
      setTimeout(() => {
        onComplete();
      }, 100);
    }
  };

  const handleDuplicateUpdate = async () => {
    if (!duplicateDialog.existingClient || !duplicateDialog.newData || !duplicateDialog.file || !duplicateDialog.blob) return;

    setDuplicateDialog(prev => ({ ...prev, show: false }));

    if (previewIndex === null) return;

    setUploads(prev => {
      const updated = [...prev];
      updated[previewIndex] = { ...updated[previewIndex], status: 'processing' };
      return updated;
    });

    try {
      await updateExistingClient(duplicateDialog.existingClient.id, duplicateDialog.newData, duplicateDialog.file, duplicateDialog.blob);
      
      setUploads(prev => {
        const updated = [...prev];
        updated[previewIndex] = { 
          ...updated[previewIndex], 
          status: 'success',
          extractedData: duplicateDialog.newData || undefined
        };
        return updated;
      });

      toast.success('Klient byl aktualizován');

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
        // No more previews - check completion and close
        setPreviewIndex(null);
        setEditedData(null);
        
        setUploads(prev => {
          const allCompleted = prev.every(u => u.status === 'success' || u.status === 'error');
          const successCount = prev.filter(u => u.status === 'success').length;
          
          if (allCompleted && successCount > 0) {
            setTimeout(() => {
              onComplete();
            }, 100);
          }
          
          return prev;
        });
      }
    } catch (error: any) {
      console.error('Error updating client:', error);
      setUploads(prev => {
        const updated = [...prev];
        updated[previewIndex] = { 
          ...updated[previewIndex], 
          status: 'error',
          error: error.message 
        };
        return updated;
      });
      toast.error('Chyba při aktualizaci klienta: ' + error.message);
    }
  };

  const handleDuplicateCreateNew = async () => {
    if (!duplicateDialog.newData || !duplicateDialog.file || !duplicateDialog.blob) return;

    setDuplicateDialog(prev => ({ ...prev, show: false }));

    if (previewIndex === null) return;

    setUploads(prev => {
      const updated = [...prev];
      updated[previewIndex] = { ...updated[previewIndex], status: 'processing' };
      return updated;
    });

    try {
      await createClient(duplicateDialog.newData, duplicateDialog.file, duplicateDialog.blob);
      
      setUploads(prev => {
        const updated = [...prev];
        updated[previewIndex] = { 
          ...updated[previewIndex], 
          status: 'success',
          extractedData: duplicateDialog.newData || undefined
        };
        return updated;
      });

      toast.success('Nový klient byl vytvořen');

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
        // No more previews - check completion and close
        setPreviewIndex(null);
        setEditedData(null);
        
        setUploads(prev => {
          const allCompleted = prev.every(u => u.status === 'success' || u.status === 'error');
          const successCount = prev.filter(u => u.status === 'success').length;
          
          if (allCompleted && successCount > 0) {
            setTimeout(() => {
              onComplete();
            }, 100);
          }
          
          return prev;
        });
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
              accept="image/jpeg,image/png,image/webp,.pdf"
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
              Upravte data dle potřeby před uložením nebo použijte "Potvrdit všechny" pro automatické uložení všech dokumentů s navrhnutými daty
            </DialogDescription>
          </DialogHeader>

          {editedData && previewIndex !== null && (
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="first_name">Jméno *</Label>
                    {uploads[previewIndex]?.ocrFilledFields?.has('first_name') && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Z OCR</span>
                      </div>
                    )}
                  </div>
                  <Input
                    id="first_name"
                    value={editedData.first_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                    className={uploads[previewIndex]?.ocrFilledFields?.has('first_name') ? "border-green-500 bg-green-500/10" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="last_name">Příjmení *</Label>
                    {uploads[previewIndex]?.ocrFilledFields?.has('last_name') && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Z OCR</span>
                      </div>
                    )}
                  </div>
                  <Input
                    id="last_name"
                    value={editedData.last_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                    className={uploads[previewIndex]?.ocrFilledFields?.has('last_name') ? "border-green-500 bg-green-500/10" : ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Datum narození</Label>
                  {uploads[previewIndex]?.ocrFilledFields?.has('date_of_birth') && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Z OCR</span>
                    </div>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editedData.date_of_birth && "text-muted-foreground",
                        uploads[previewIndex]?.ocrFilledFields?.has('date_of_birth') && "border-green-500 bg-green-500/10"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editedData.date_of_birth ? (
                        (() => {
                          const date = parseDateDDMMYY(editedData.date_of_birth);
                          return date ? format(date, "d. MMMM yyyy", { locale: cs }) : editedData.date_of_birth;
                        })()
                      ) : (
                        <span>Vyberte datum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editedData.date_of_birth ? parseDateDDMMYY(editedData.date_of_birth) || undefined : undefined}
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="passport_number">Číslo pasu</Label>
                        {uploads[previewIndex]?.ocrFilledFields?.has('passport_number') && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Z OCR</span>
                          </div>
                        )}
                      </div>
                      <Input
                        id="passport_number"
                        value={editedData.passport_number || ''}
                        onChange={(e) => setEditedData({ ...editedData, passport_number: e.target.value })}
                        className={uploads[previewIndex]?.ocrFilledFields?.has('passport_number') ? "border-green-500 bg-green-500/10" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Platnost pasu</Label>
                        {uploads[previewIndex]?.ocrFilledFields?.has('passport_expiry') && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Z OCR</span>
                          </div>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editedData.passport_expiry && "text-muted-foreground",
                              uploads[previewIndex]?.ocrFilledFields?.has('passport_expiry') && "border-green-500 bg-green-500/10"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editedData.passport_expiry ? (
                              (() => {
                                const date = parseDateDDMMYY(editedData.passport_expiry);
                                return date ? format(date, "d. MMMM yyyy", { locale: cs }) : editedData.passport_expiry;
                              })()
                            ) : (
                              <span>Vyberte datum</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editedData.passport_expiry ? parseDateDDMMYY(editedData.passport_expiry) || undefined : undefined}
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="id_card_number">Číslo občanského průkazu</Label>
                        {uploads[previewIndex]?.ocrFilledFields?.has('id_card_number') && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Z OCR</span>
                          </div>
                        )}
                      </div>
                      <Input
                        id="id_card_number"
                        value={editedData.id_card_number || ''}
                        onChange={(e) => setEditedData({ ...editedData, id_card_number: e.target.value })}
                        className={uploads[previewIndex]?.ocrFilledFields?.has('id_card_number') ? "border-green-500 bg-green-500/10" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Platnost OP</Label>
                        {uploads[previewIndex]?.ocrFilledFields?.has('id_card_expiry') && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Z OCR</span>
                          </div>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editedData.id_card_expiry && "text-muted-foreground",
                              uploads[previewIndex]?.ocrFilledFields?.has('id_card_expiry') && "border-green-500 bg-green-500/10"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editedData.id_card_expiry ? (
                              (() => {
                                const date = parseDateDDMMYY(editedData.id_card_expiry);
                                return date ? format(date, "d. MMMM yyyy", { locale: cs }) : editedData.id_card_expiry;
                              })()
                            ) : (
                              <span>Vyberte datum</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editedData.id_card_expiry ? parseDateDDMMYY(editedData.id_card_expiry) || undefined : undefined}
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

          <DialogFooter className="flex justify-between items-center">
            <Button 
              variant="secondary" 
              onClick={handleConfirmAll}
              disabled={isBatchProcessing}
            >
              {isBatchProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zpracovávám všechny...
                </>
              ) : (
                'Potvrdit všechny'
              )}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSkipPreview} disabled={isBatchProcessing}>
                Přeskočit tento
              </Button>
              <Button onClick={handleConfirmPreview} disabled={isBatchProcessing}>
                Potvrdit a pokračovat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Client Dialog */}
      <Dialog open={duplicateDialog.show} onOpenChange={(open) => {
        if (!open) {
          setDuplicateDialog(prev => ({ ...prev, show: false }));
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicitní klient nalezen</DialogTitle>
            <DialogDescription>
              V systému již existuje klient s podobnými údaji.
            </DialogDescription>
          </DialogHeader>

          {duplicateDialog.existingClient && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Existující klient:</h4>
                <p className="text-sm">
                  <span className="font-medium">Jméno:</span> {duplicateDialog.existingClient.first_name} {duplicateDialog.existingClient.last_name}
                </p>
                {duplicateDialog.existingClient.passport_number && (
                  <p className="text-sm">
                    <span className="font-medium">Pas:</span> {duplicateDialog.existingClient.passport_number}
                  </p>
                )}
                {duplicateDialog.existingClient.id_card_number && (
                  <p className="text-sm">
                    <span className="font-medium">OP:</span> {duplicateDialog.existingClient.id_card_number}
                  </p>
                )}
              </div>

              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <h4 className="font-medium">Nová data z dokumentu:</h4>
                <p className="text-sm">
                  <span className="font-medium">Jméno:</span> {duplicateDialog.newData?.first_name} {duplicateDialog.newData?.last_name}
                </p>
                {duplicateDialog.newData?.passport_number && (
                  <p className="text-sm">
                    <span className="font-medium">Pas:</span> {duplicateDialog.newData.passport_number}
                  </p>
                )}
                {duplicateDialog.newData?.id_card_number && (
                  <p className="text-sm">
                    <span className="font-medium">OP:</span> {duplicateDialog.newData.id_card_number}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button 
              variant="secondary" 
              onClick={handleDuplicateUpdate}
              className="flex-1"
            >
              Aktualizovat existujícího
            </Button>
            <Button 
              onClick={handleDuplicateCreateNew}
              className="flex-1"
            >
              Vytvořit nového
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
