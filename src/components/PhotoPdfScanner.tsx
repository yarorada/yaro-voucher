import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2, ArrowUp, ArrowDown, Plus, Check, Crop as CropIcon } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import Cropper, { Area } from "react-easy-crop";

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
const EDGE_SAMPLE = 260; // downscaled dim for edge detection
const BG_THRESHOLD = 22; // luminance delta vs background to consider as document (lower = more sensitive crop)
const ADAPTIVE_WINDOW = 25; // half-window radius (px) for local mean (≈ 51px window)
const ADAPTIVE_BIAS = 12; // subtract from local mean to whiten background and remove shadows

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

  // No padding — crop tightly to detected content, removing all background
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(sw - 1, maxX);
  maxY = Math.min(sh - 1, maxY);

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

    // Step 4: scanner-like processing — adaptive (local) thresholding to remove shadows
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;
    const N = outW * outH;

    // Build luminance plane
    const lum = new Float32Array(N);
    for (let i = 0, p = 0; p < N; i += 4, p++) {
      lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }

    // Build integral image (summed-area table) of luminance for O(1) box mean
    const sat = new Float64Array(N);
    for (let y = 0; y < outH; y++) {
      let rowSum = 0;
      for (let x = 0; x < outW; x++) {
        const idx = y * outW + x;
        rowSum += lum[idx];
        sat[idx] = rowSum + (y > 0 ? sat[idx - outW] : 0);
      }
    }

    const boxSum = (x1: number, y1: number, x2: number, y2: number): number => {
      // inclusive coords; clamp inside
      if (x1 < 0) x1 = 0; if (y1 < 0) y1 = 0;
      if (x2 >= outW) x2 = outW - 1; if (y2 >= outH) y2 = outH - 1;
      const A = (x1 > 0 && y1 > 0) ? sat[(y1 - 1) * outW + (x1 - 1)] : 0;
      const B = (y1 > 0) ? sat[(y1 - 1) * outW + x2] : 0;
      const C = (x1 > 0) ? sat[y2 * outW + (x1 - 1)] : 0;
      const D = sat[y2 * outW + x2];
      return D - B - C + A;
    };

    // Adaptive threshold: pixel is black if it's noticeably darker than its local neighborhood mean
    const r = ADAPTIVE_WINDOW;
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const x1 = x - r, y1 = y - r, x2 = x + r, y2 = y + r;
        const xx1 = Math.max(0, x1), yy1 = Math.max(0, y1);
        const xx2 = Math.min(outW - 1, x2), yy2 = Math.min(outH - 1, y2);
        const area = (xx2 - xx1 + 1) * (yy2 - yy1 + 1);
        const mean = boxSum(xx1, yy1, xx2, yy2) / area;
        const p = y * outW + x;
        const out = lum[p] < mean - ADAPTIVE_BIAS ? 0 : 255;
        const i = p * 4;
        d[i] = out; d[i + 1] = out; d[i + 2] = out;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Step 5: post-binarization tight crop — remove leftover uniform borders (any solid edge)
    let tMinX = outW, tMinY = outH, tMaxX = 0, tMaxY = 0;
    let tFound = false;
    // Sample every pixel on the now-binary image; find black ink bounds
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const i = (y * outW + x) * 4;
        if (d[i] < 128) {
          if (x < tMinX) tMinX = x;
          if (y < tMinY) tMinY = y;
          if (x > tMaxX) tMaxX = x;
          if (y > tMaxY) tMaxY = y;
          tFound = true;
        }
      }
    }

    let finalCanvas = canvas;
    let finalW = outW;
    let finalH = outH;
    if (tFound && (tMaxX - tMinX) > outW * 0.3 && (tMaxY - tMinY) > outH * 0.3) {
      finalW = tMaxX - tMinX + 1;
      finalH = tMaxY - tMinY + 1;
      const cropped = document.createElement("canvas");
      cropped.width = finalW;
      cropped.height = finalH;
      const cctx = cropped.getContext("2d")!;
      cctx.drawImage(canvas, tMinX, tMinY, finalW, finalH, 0, 0, finalW, finalH);
      finalCanvas = cropped;
    }

    const dataUrl = finalCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { dataUrl, width: finalW, height: finalH };
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

  // Cropper state
  const [cropPageId, setCropPageId] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const cropPage = pages.find((p) => p.id === cropPageId) || null;

  const applyCrop = async () => {
    if (!cropPage || !croppedAreaPixels) { setCropPageId(null); return; }
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = cropPage.dataUrl;
      });
      const cw = Math.max(1, Math.round(croppedAreaPixels.width));
      const ch = Math.max(1, Math.round(croppedAreaPixels.height));
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const cctx = c.getContext("2d")!;
      cctx.drawImage(
        img,
        Math.round(croppedAreaPixels.x),
        Math.round(croppedAreaPixels.y),
        cw,
        ch,
        0,
        0,
        cw,
        ch,
      );
      const dataUrl = c.toDataURL("image/jpeg", JPEG_QUALITY);
      setPages((prev) => prev.map((p) => p.id === cropPage.id ? { ...p, dataUrl, width: cw, height: ch } : p));
      setCropPageId(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se oříznout");
    }
  };

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
      // Auto-offer crop for the first newly added page
      if (newPages.length > 0) {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        setCropPageId(newPages[0].id);
      }
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
