import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, Search, Check } from "lucide-react";
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

interface HotelImageUploadProps {
  hotelId: string;
  hotelName?: string;
  golfCourseName?: string;
  imageUrl: string | null;
  imageUrl2: string | null;
  imageUrl3: string | null;
  onUpdate: () => void;
}

const IMAGE_LABELS = [
  { key: "image_url", label: "Hlavní foto hotelu" },
  { key: "image_url_2", label: "Foto pokoje" },
  { key: "image_url_3", label: "Golf / Pláž / Signature" },
] as const;

type ImageSlot = "image_url" | "image_url_2" | "image_url_3";

export function HotelImageUpload({ hotelId, hotelName, golfCourseName, imageUrl, imageUrl2, imageUrl3, onUpdate }: HotelImageUploadProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [foundImages, setFoundImages] = useState<{ hotel: string[]; golf: string[] } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ImageSlot | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const images: Record<string, string | null> = {
    image_url: imageUrl,
    image_url_2: imageUrl2,
    image_url_3: imageUrl3,
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
        
        // Auto-save hotel description if found
        if (data.hotelDescription && hotelId) {
          await supabase
            .from("hotel_templates")
            .update({ description: data.hotelDescription } as any)
            .eq("id", hotelId);
        }
        
        if (hotelImgs.length === 0 && golfImgs.length === 0) {
          toast.info("Nepodařilo se najít žádné fotky na oficiálních stránkách");
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
      // Download the image, compress and upload to our storage
      const response = await fetch(url);
      const blob = await response.blob();
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
      {/* Auto-find button */}
      {hotelName && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleScrape}
          disabled={scraping}
        >
          {scraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {scraping ? "Hledám fotky..." : "Najít fotky z webu hotelu"}
        </Button>
      )}

      {/* Manual upload grid */}
      <div className="grid grid-cols-3 gap-3">
        {IMAGE_LABELS.map(({ key, label }) => {
          const url = images[key];
          const isUploading = uploading === key;

          return (
            <div key={key} className="space-y-1">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <div className="relative aspect-[4/3] rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden group">
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
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {isUploading ? "Nahrávám..." : "Nahrát"}
                    </span>
                  </button>
                )}
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
          <div className="flex gap-2 flex-wrap">
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
                    <button
                      key={i}
                      type="button"
                      disabled={!selectedSlot || savingUrl === url}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => selectedSlot && handleSelectImage(url, selectedSlot)}
                    >
                      {savingUrl === url && (
                        <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      <img
                        src={url}
                        alt={`Hotel ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </button>
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
                    <button
                      key={i}
                      type="button"
                      disabled={!selectedSlot || savingUrl === url}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => selectedSlot && handleSelectImage(url, selectedSlot)}
                    >
                      {savingUrl === url && (
                        <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      <img
                        src={url}
                        alt={`Golf ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </button>
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
