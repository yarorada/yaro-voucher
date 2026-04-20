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

const MAX_DIM = 1600; // px - max dimension for compressed image (iOS-scanner-like)
const JPEG_QUALITY = 0.6; // aggressive compression after binarization
const EDGE_SAMPLE = 220; // downscaled dim for edge detection
const BG_THRESHOLD = 38; // luminance delta vs background to consider as document

/** Detect a rectangular content bounding box by finding pixels that differ from the dominant background color. */
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  // Downscale to a small canvas for fast analysis
  const scale = Math.min(1, EDGE_SAMPLE / Math.max(width, height));
  const sw = Math.max(32, Math.round(width * scale));
  const sh = Math.max(32, Math.round(height * scale));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;

  // Estimate background color from the corners (8x8 patches)
  const patch = 8;
  const corners: Array<[number, number]> = [
    [0, 0],
    [sw - patch, 0],
    [0, sh - patch],
    [sw - patch, sh - patch],
  ];
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + patch; y++) {
      for (let x = cx; x < cx + patch; x++) {
        const i = (y * sw + x) * 4;
        br += data[i];
        bg += data[i + 1];
        bb += data[i + 2];
        bn++;
      }
    }
  }
  br /= bn; bg /= bn; bb /= bn;
  const bgLum = 0.299 * br + 0.587 * bg + 0.114 * bb;

  // Find min/max coords of pixels that differ enough from background luminance
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (Math.abs(lum - bgLum) > BG_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found || maxX - minX < sw * 0.3 || maxY - minY < sh * 0.3) {
    // Fallback: no clear document detected, use full image
    return { x: 0, y: 0, w: width, h: height };
  }

  // Add small padding and map back to original coords
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(sw - 1, maxX + pad);
  maxY = Math.min(sh - 1, maxY + pad);

  const sx = minX / sw;
  const sy = minY / sh;
  const sx2 = (maxX + 1) / sw;
  const sy2 = (maxY + 1) / sh;

  return {
    x: Math.round(sx * width),
    y: Math.round(sy * height),
    w: Math.round((sx2 - sx) * width),
    h: Math.round((sy2 - sy) * height),
  };
}

async function processImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = blobUrl;
    });

    // Step 1: draw original at native size for accurate edge detection
    const full = document.createElement("canvas");
    full.width = img.width;
    full.height = img.height;
    const fctx = full.getContext("2d")!;
    fctx.drawImage(img, 0, 0);

    // Step 2: detect document bounds and crop background
    const bounds = detectContentBounds(fctx, full.width, full.height);

    // Step 3: scale cropped region to MAX_DIM
    const scale = Math.min(1, MAX_DIM / Math.max(bounds.w, bounds.h));
    const outW = Math.max(1, Math.round(bounds.w * scale));
    const outH = Math.max(1, Math.round(bounds.h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, outW, outH);

    // Step 4: scanner-like processing — grayscale, auto-levels, gamma boost
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;

    // Build luminance histogram (sampled)
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 16) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      hist[Math.round(lum)]++;
    }
    // Determine 2% / 98% percentiles for robust min/max
    const totalSamples = (d.length / 16) | 0;
    const lowCut = totalSamples * 0.02;
    const highCut = totalSamples * 0.98;
    let cum = 0;
    let min = 0, max = 255;
    for (let i = 0; i < 256; i++) {
      cum += hist[i];
      if (cum >= lowCut) { min = i; break; }
    }
    cum = 0;
    for (let i = 0; i < 256; i++) {
      cum += hist[i];
      if (cum >= highCut) { max = i; break; }
    }
    const range = Math.max(1, max - min);
    const factor = 255 / range;
    const gamma = 0.85; // slight brightening — punch up the page background to white

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = (lum - min) * factor;
      if (v < 0) v = 0; else if (v > 255) v = 255;
      // gamma correction
      v = 255 * Math.pow(v / 255, gamma);
      const out = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = out;
      d[i + 1] = out;
      d[i + 2] = out;
    }
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { dataUrl, width: outW, height: outH };
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
