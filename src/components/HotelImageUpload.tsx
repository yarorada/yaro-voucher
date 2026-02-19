import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage, isImageFile } from "@/lib/imageCompression";

interface HotelImageUploadProps {
  hotelId: string;
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

export function HotelImageUpload({ hotelId, imageUrl, imageUrl2, imageUrl3, onUpdate }: HotelImageUploadProps) {
  const [uploading, setUploading] = useState<string | null>(null);
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

  return (
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
  );
}
