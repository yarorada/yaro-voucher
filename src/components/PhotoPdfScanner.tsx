import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2, ArrowUp, ArrowDown, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

type Page = {
  id: string;
  dataUrl: string; // processed (auto-contrast + compressed) data URL (image/jpeg)
  width: number;
  height: number;
};

type Props = {
  onPdfReady: (file: File) => void;
  disabled?: boolean;
  triggerLabel?: string;
};

const MAX_DIM = 1800; // px - max dimension for compressed image
const JPEG_QUALITY = 0.78;

async function processImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = blobUrl;
    });

    let { width, height } = img;
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    // Auto-contrast: stretch luminance to full range, slight brightness boost
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    let min = 255;
    let max = 0;
    // sample every 4th pixel for speed
    for (let i = 0; i < d.length; i += 16) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const range = Math.max(1, max - min);
    const factor = 255 / range;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, (d[i] - min) * factor));
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - min) * factor));
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - min) * factor));
    }
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function PhotoPdfScanner({ onPdfReady, disabled, triggerLabel = "Vyfotit stránky" }: Props) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [processing, setProcessing] = useState(false);
  const [building, setBuilding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      const newPages: Page[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const p = await processImage(f);
        newPages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...p,
        });
      }
      setPages((prev) => [...prev, ...newPages]);
      if (!open) setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se zpracovat obrázky");
    } finally {
      setProcessing(false);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildPdf = async () => {
    if (pages.length === 0) return;
    setBuilding(true);
    try {
      const first = pages[0];
      const orientation = first.width > first.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation });

      pages.forEach((p, i) => {
        const o = p.width > p.height ? "landscape" : "portrait";
        if (i > 0) pdf.addPage("a4", o);
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        // fit with margins
        const margin = 12;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / p.width, maxH / p.height);
        const w = p.width * ratio;
        const h = p.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(p.dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
      });

      const blob = pdf.output("blob");
      const file = new File([blob], `scan-${Date.now()}.pdf`, { type: "application/pdf" });
      onPdfReady(file);
      setPages([]);
      setOpen(false);
      toast.success("PDF vytvořeno – spouští se OCR…");
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se vytvořit PDF");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={addMoreRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || processing}
      >
        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
        {processing ? "Zpracovávám…" : triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!building) setOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stránky dokladu ({pages.length})</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {pages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Žádné stránky. Přidejte fotky tlačítkem níže.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pages.map((p, idx) => (
                <div key={p.id} className="border rounded-md overflow-hidden bg-muted relative group">
                  <img src={p.dataUrl} alt={`Strana ${idx + 1}`} className="w-full h-40 object-contain bg-background" />
                  <div className="px-2 py-1 flex items-center justify-between text-xs">
                    <span className="font-medium">Strana {idx + 1}</span>
                    <div className="flex gap-0.5">
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === pages.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => addMoreRef.current?.click()} disabled={building || processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Přidat další stránku
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPages([]); setOpen(false); }} disabled={building}>
                Zrušit
              </Button>
              <Button type="button" size="sm" onClick={buildPdf} disabled={building || pages.length === 0}>
                {building ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Uložit jako PDF a skenovat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
