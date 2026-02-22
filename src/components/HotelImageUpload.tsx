import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, X, Loader2, Search, Check, Link, FileText, Code, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage, isImageFile } from "@/lib/imageCompression";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Component to display images through proxy (avoids CORS/hotlink blocking)
const ProxiedImageButton = ({ url, alt, disabled, saving, onClick }: {
  url: string; alt: string; disabled: boolean; saving: boolean; onClick: () => void;
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Try direct load first, fall back to proxy
    const img = new Image();
    img.onload = () => { if (!cancelled) setSrc(url); };
    img.onerror = () => {
      if (cancelled) return;
      // Load via proxy
      supabase.functions.invoke("proxy-image", { body: { url } }).then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.base64) {
          setSrc(`data:${data.contentType || "image/jpeg"};base64,${data.base64}`);
        } else {
          setFailed(true);
        }
      });
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  if (failed) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onClick}
    >
      {saving && (
        <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </button>
  );
};

interface HotelImageUploadProps {
  hotelId: string;
  hotelName?: string;
  golfCourseName?: string;
  imageUrl: string | null;
  imageUrl2: string | null;
  imageUrl3: string | null;
  imageUrl4?: string | null;
  imageUrl5?: string | null;
  imageUrl6?: string | null;
  imageUrl7?: string | null;
  imageUrl8?: string | null;
  imageUrl9?: string | null;
  imageUrl10?: string | null;
  description: string | null;
  onUpdate: () => void;
  autoScrape?: boolean;
}

const IMAGE_LABELS = [
  { key: "image_url", label: "Hlavní foto" },
  { key: "image_url_2", label: "Foto pokoje" },
  { key: "image_url_3", label: "Golf / Pláž" },
  { key: "image_url_4", label: "Foto 4" },
  { key: "image_url_5", label: "Foto 5" },
  { key: "image_url_6", label: "Foto 6" },
  { key: "image_url_7", label: "Foto 7" },
  { key: "image_url_8", label: "Foto 8" },
  { key: "image_url_9", label: "Foto 9" },
  { key: "image_url_10", label: "Foto 10" },
] as const;

type ImageSlot = "image_url" | "image_url_2" | "image_url_3" | "image_url_4" | "image_url_5" | "image_url_6" | "image_url_7" | "image_url_8" | "image_url_9" | "image_url_10";

export function HotelImageUpload({ hotelId, hotelName, golfCourseName, imageUrl, imageUrl2, imageUrl3, imageUrl4, imageUrl5, imageUrl6, imageUrl7, imageUrl8, imageUrl9, imageUrl10, description, onUpdate, autoScrape: autoScrapeProp }: HotelImageUploadProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [foundImages, setFoundImages] = useState<{ hotel: string[]; golf: string[] } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ImageSlot | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState(description || "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [savingUrlInput, setSavingUrlInput] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const autoScrapeDone = useRef(false);
  const [descriptionOpen, setDescriptionOpen] = useState(!!description);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Auto-trigger scrape + description when component mounts with autoScrape prop
  useEffect(() => {
    if (autoScrapeProp && hotelName && !autoScrapeDone.current) {
      autoScrapeDone.current = true;
      // Run both in parallel
      handleScrape();
      handleGenerateDescription();
    }
  }, [autoScrapeProp, hotelName]);

  const images: Record<string, string | null> = {
    image_url: imageUrl,
    image_url_2: imageUrl2,
    image_url_3: imageUrl3,
    image_url_4: imageUrl4 || null,
    image_url_5: imageUrl5 || null,
    image_url_6: imageUrl6 || null,
    image_url_7: imageUrl7 || null,
    image_url_8: imageUrl8 || null,
    image_url_9: imageUrl9 || null,
    image_url_10: imageUrl10 || null,
  };

  const handleUpload = async (field: string, file: File) => {
    if (!isImageFile(file)) {
      toast.error("Prosím vyberte obrázek (JPG, PNG, WebP)");
      return;
    }

    setUploading(field);
    try {
      const { blob } = await compressImage(file, 1920, 1080, 0.85);
      const fileName = `${hotelId}/${field}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("hotel-images")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("hotel-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("hotel_templates")
        .update({ [field]: publicUrlData.publicUrl } as any)
        .eq("id", hotelId);

      if (updateError) throw updateError;

      toast.success("Foto nahráno");
      onUpdate();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Nepodařilo se nahrát foto");
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (field: string) => {
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .update({ [field]: null } as any)
        .eq("id", hotelId);

      if (error) throw error;
      toast.success("Foto odstraněno");
      onUpdate();
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Nepodařilo se odstranit foto");
    }
  };

  const handleSaveFromUrl = async (field: string, url: string) => {
    if (!url.trim()) return;
    
    setSavingUrlInput(field);
    try {
      // Download via proxy to avoid CORS
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-image", {
        body: { url: url.trim() },
      });

      if (proxyError || !proxyData?.base64) {
        throw new Error(proxyError?.message || "Proxy download failed");
      }

      const byteString = atob(proxyData.base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: proxyData.contentType || "image/jpeg" });
      const file = new File([blob], "downloaded.jpg", { type: blob.type });

      const compressed = await compressImage(file, 1920, 1080, 0.85);
      const fileName = `${hotelId}/${field}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("hotel-images")
        .upload(fileName, compressed.blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("hotel-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("hotel_templates")
        .update({ [field]: publicUrlData.publicUrl } as any)
        .eq("id", hotelId);

      if (updateError) throw updateError;

      toast.success("Foto uloženo z URL");
      setUrlInputs((prev) => ({ ...prev, [field]: "" }));
      onUpdate();
    } catch (error) {
      console.error("URL save error:", error);
      toast.error("Nepodařilo se uložit foto z URL");
    } finally {
      setSavingUrlInput(null);
    }
  };

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      const { error } = await supabase
        .from("hotel_templates")
        .update({ description: editDescription.trim() || null } as any)
        .eq("id", hotelId);

      if (error) throw error;
      toast.success("Popis hotelu uložen");
      onUpdate();
    } catch (error) {
      console.error("Description save error:", error);
      toast.error("Nepodařilo se uložit popis");
    } finally {
      setSavingDescription(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!hotelName) {
      toast.error("Nejdříve vyberte hotel");
      return;
    }

    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-hotel-info", {
        body: { hotelName, golfCourseName },
      });

      if (error) throw error;

      if (data?.success && data.description) {
        // Strip citation numbers like [1], [2][3]
        const cleanDesc = data.description.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
        // Convert plain text paragraphs to HTML
        const htmlDesc = cleanDesc.split(/\n{2,}/).map((p: string) => `<p>${p.trim()}</p>`).join("\n");
        await supabase
          .from("hotel_templates")
          .update({ description: htmlDesc } as any)
          .eq("id", hotelId);
        setEditDescription(htmlDesc);
        setDescriptionOpen(true);
        // Store image URLs from Perplexity as fallback for scraping
        if (data.imageUrls?.length > 0) {
          perplexityImagesRef.current = data.imageUrls;
        }
        toast.success("Popis hotelu vygenerován");
        onUpdate();
      } else {
        toast.error(data?.error || "Nepodařilo se vygenerovat popis");
      }
    } catch (error) {
      console.error("Generate description error:", error);
      toast.error("Nepodařilo se vygenerovat popis");
    } finally {
      setGeneratingDescription(false);
    }
  };

  // Store Perplexity images as fallback
  const perplexityImagesRef = useRef<string[]>([]);

  const handleScrape = async () => {
    if (!hotelName) {
      toast.error("Nejdříve vyberte hotel");
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-hotel-images", {
        body: { hotelName, golfCourseName },
      });

      if (error) throw error;

      if (data?.success) {
        const hotelImgs = data.hotelImages || [];
        const golfImgs = data.golfImages || [];
        
        if (hotelImgs.length === 0 && golfImgs.length === 0) {
          // Fallback: use Perplexity images if available
          if (perplexityImagesRef.current.length > 0) {
            setFoundImages({ hotel: perplexityImagesRef.current, golf: [] });
            setPickerOpen(true);
            toast.success(`Nalezeno ${perplexityImagesRef.current.length} fotek přes AI vyhledávání`);
          } else {
            // Try fetching from Perplexity now
            try {
              const { data: infoData } = await supabase.functions.invoke("search-hotel-info", {
                body: { hotelName, golfCourseName },
              });
              if (infoData?.imageUrls?.length > 0) {
                setFoundImages({ hotel: infoData.imageUrls, golf: [] });
                setPickerOpen(true);
                toast.success(`Nalezeno ${infoData.imageUrls.length} fotek přes AI vyhledávání`);
              } else {
                toast.info("Nepodařilo se najít fotky. Zkuste nahrát fotky ručně.");
              }
            } catch {
              toast.info("Nepodařilo se najít fotky na oficiálních stránkách. Zkuste nahrát fotky ručně.");
            }
          }
        } else {
          setFoundImages({ hotel: hotelImgs, golf: golfImgs });
          setPickerOpen(true);
          toast.success(`Nalezeno ${hotelImgs.length + golfImgs.length} fotek`);
        }
      } else {
        toast.error(data?.error || "Nepodařilo se vyhledat fotky");
      }
    } catch (error) {
      console.error("Scrape error:", error);
      toast.error("Nepodařilo se vyhledat fotky");
    } finally {
      setScraping(false);
    }
  };

  const handleSelectImage = async (url: string, slot: ImageSlot) => {
    setSavingUrl(url);
    try {
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-image", {
        body: { url },
      });

      if (proxyError || !proxyData?.base64) {
        // Remove the broken URL from found images so user doesn't try again
        setFoundImages(prev => prev ? {
          hotel: prev.hotel.filter(u => u !== url),
          golf: prev.golf.filter(u => u !== url),
        } : null);
        toast.error("Tento obrázek není dostupný (neplatná URL). Zkuste jiný.");
        setSavingUrl(null);
        return;
      }

      const byteString = atob(proxyData.base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: proxyData.contentType || "image/jpeg" });
      const file = new File([blob], "downloaded.jpg", { type: blob.type });
      
      const compressed = await compressImage(file, 1920, 1080, 0.85);
      const fileName = `${hotelId}/${slot}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("hotel-images")
        .upload(fileName, compressed.blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("hotel-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("hotel_templates")
        .update({ [slot]: publicUrlData.publicUrl } as any)
        .eq("id", hotelId);

      if (updateError) throw updateError;

      toast.success(`Foto uloženo jako "${IMAGE_LABELS.find(l => l.key === slot)?.label}"`);
      onUpdate();
    } catch (error) {
      console.error("Save image error:", error);
      toast.error("Nepodařilo se uložit foto");
    } finally {
      setSavingUrl(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Action buttons row */}
      {hotelName && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {scraping ? "Hledám fotky..." : "Najít fotky z webu"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleGenerateDescription}
            disabled={generatingDescription}
          >
            {generatingDescription ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {generatingDescription ? "Generuji popis..." : "Vygenerovat popis"}
          </Button>
          {description && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
            >
              <FileText className="h-4 w-4" />
              {descriptionOpen ? "Skrýt popis" : "Zobrazit popis"}
            </Button>
          )}
        </div>
      )}

      {/* Hotel description (collapsible) */}
      {descriptionOpen && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Popis hotelu</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => {
                if (!htmlMode && editorRef.current) {
                  // Switching to HTML mode - sync from contentEditable
                  setEditDescription(editorRef.current.innerHTML);
                }
                setHtmlMode(!htmlMode);
              }}
            >
              {htmlMode ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
              {htmlMode ? "Náhled" : "HTML"}
            </Button>
          </div>
          {htmlMode ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="<p>Popis hotelu...</p>"
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: editDescription }}
              onBlur={(e) => setEditDescription(e.currentTarget.innerHTML)}
              className="w-full min-h-[80px] max-h-[200px] overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-bold [&_em]:italic"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          )}
          {editDescription !== (description || "") && (
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSaveDescription}
              disabled={savingDescription}
            >
              {savingDescription ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Uložit popis
            </Button>
          )}
        </div>
      )}

      {/* Manual upload grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {IMAGE_LABELS.map(({ key, label }) => {
          const url = images[key];
          const isUploading = uploading === key;

          return (
            <div key={key} className="space-y-1">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <div
                className={`relative aspect-[4/3] rounded-lg border-2 border-dashed bg-muted/30 overflow-hidden group transition-colors ${
                  dragOver === key ? "border-primary bg-primary/10" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(null); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation(); setDragOver(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleUpload(key, file);
                }}
              >
                {url ? (
                  <>
                    <img src={url} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => fileInputRefs.current[key]?.click()}
                      >
                        Změnit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 w-7 p-0"
                        onClick={() => handleRemove(key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRefs.current[key]?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : dragOver === key ? (
                      <ImagePlus className="h-6 w-6 text-primary" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {isUploading ? "Nahrávám..." : dragOver === key ? "Pusťte zde" : "Nahrát / přetáhnout"}
                    </span>
                  </button>
                )}
              </div>
              {/* URL input */}
              <div className="flex gap-1">
                <Input
                  value={urlInputs[key] || ""}
                  onChange={(e) => setUrlInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="URL obrázku"
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 shrink-0"
                  disabled={!urlInputs[key]?.trim() || savingUrlInput === key}
                  onClick={() => handleSaveFromUrl(key, urlInputs[key] || "")}
                >
                  {savingUrlInput === key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Link className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <input
                ref={(el) => { fileInputRefs.current[key] = el; }}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(key, file);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Image picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Nalezené fotky – klikněte pro přiřazení</DialogTitle>
          </DialogHeader>
          
          {/* Slot selector */}
          <div className="flex gap-2 flex-wrap items-center">
            {IMAGE_LABELS.map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={selectedSlot === key ? "default" : "outline"}
                onClick={() => setSelectedSlot(key as ImageSlot)}
                className="text-xs"
              >
                {selectedSlot === key && <Check className="h-3 w-3 mr-1" />}
                {label}
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={handleScrape}
              >
                <Search className="h-3 w-3" />
                Hledat znovu
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => setPickerOpen(false)}
              >
                Hotovo
              </Button>
            </div>
          </div>
          
          {!selectedSlot && (
            <p className="text-sm text-muted-foreground">
              Nejdříve vyberte slot (hlavní foto, pokoj, golf) a pak klikněte na fotku.
            </p>
          )}

          <ScrollArea className="h-[55vh]">
            {foundImages?.hotel && foundImages.hotel.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  🏨 Fotky hotelu ({foundImages.hotel.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {foundImages.hotel.map((url, i) => (
                    <ProxiedImageButton
                      key={`hotel-${i}-${url}`}
                      url={url}
                      alt={`Hotel ${i + 1}`}
                      disabled={!selectedSlot || savingUrl === url}
                      saving={savingUrl === url}
                      onClick={() => selectedSlot && handleSelectImage(url, selectedSlot)}
                    />
                  ))}
                </div>
              </div>
            )}

            {foundImages?.golf && foundImages.golf.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  ⛳ Fotky golfového hřiště ({foundImages.golf.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {foundImages.golf.map((url, i) => (
                    <ProxiedImageButton
                      key={`golf-${i}-${url}`}
                      url={url}
                      alt={`Golf ${i + 1}`}
                      disabled={!selectedSlot || savingUrl === url}
                      saving={savingUrl === url}
                      onClick={() => selectedSlot && handleSelectImage(url, selectedSlot)}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
