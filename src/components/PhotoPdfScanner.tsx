import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2, ArrowUp, ArrowDown, Plus, Check, Crop as CropIcon } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

type Page = {
  id: string;
  dataUrl: string; // processed (auto-contrast + compressed) data URL (image/jpeg)
  width: number;
  height: number;
};

type Rect = { x: number; y: number; w: number; h: number };
type ImgLayout = { left: number; top: number; width: number; height: number };

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function CropOverlay({
  page,
  rect,
  setRect,
  imgLayout,
}: {
  page: Page;
  rect: Rect;
  setRect: (r: Rect) => void;
  imgLayout: ImgLayout;
}) {
  // Convert image-pixel coords <-> displayed (container) coords
  const sx = imgLayout.width / page.width;
  const sy = imgLayout.height / page.height;
  const dispLeft = imgLayout.left + rect.x * sx;
  const dispTop = imgLayout.top + rect.y * sy;
  const dispW = rect.w * sx;
  const dispH = rect.h * sy;

  const startDrag = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...rect };

    const onMove = (ev: PointerEvent) => {
      const dxDisp = ev.clientX - startX;
      const dyDisp = ev.clientY - startY;
      const dxImg = dxDisp / sx;
      const dyImg = dyDisp / sy;
      let { x, y, w, h } = start;
      const minSize = 20; // image px

      if (handle === "move") {
        x = Math.min(Math.max(0, x + dxImg), page.width - w);
        y = Math.min(Math.max(0, y + dyImg), page.height - h);
      } else {
        if (handle.includes("e")) {
          w = Math.max(minSize, Math.min(page.width - x, start.w + dxImg));
        }
        if (handle.includes("s")) {
          h = Math.max(minSize, Math.min(page.height - y, start.h + dyImg));
        }
        if (handle.includes("w")) {
          const nx = Math.max(0, Math.min(start.x + start.w - minSize, start.x + dxImg));
          w = start.w + (start.x - nx);
          x = nx;
        }
        if (handle.includes("n")) {
          const ny = Math.max(0, Math.min(start.y + start.h - minSize, start.y + dyImg));
          h = start.h + (start.y - ny);
          y = ny;
        }
      }
      setRect({ x, y, w, h });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try { (e.target as HTMLElement).releasePointerCapture(ev.pointerId); } catch {}
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleStyle = "absolute w-3 h-3 bg-primary border-2 border-background rounded-sm shadow";

  return (
    <div
      className="absolute border-2 border-primary cursor-move"
      style={{ left: dispLeft, top: dispTop, width: dispW, height: dispH, boxShadow: "0 0 0 9999px hsl(var(--background) / 0.55)" }}
      onPointerDown={(e) => startDrag(e, "move")}
    >
      {/* Edge handles */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 cursor-n-resize" onPointerDown={(e) => startDrag(e, "n")} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 cursor-s-resize" onPointerDown={(e) => startDrag(e, "s")} />
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-6 w-2 cursor-w-resize" onPointerDown={(e) => startDrag(e, "w")} />
      <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-6 w-2 cursor-e-resize" onPointerDown={(e) => startDrag(e, "e")} />
      {/* Corner handles */}
      <div className={`${handleStyle} -top-1.5 -left-1.5 cursor-nw-resize`} onPointerDown={(e) => startDrag(e, "nw")} />
      <div className={`${handleStyle} -top-1.5 -right-1.5 cursor-ne-resize`} onPointerDown={(e) => startDrag(e, "ne")} />
      <div className={`${handleStyle} -bottom-1.5 -left-1.5 cursor-sw-resize`} onPointerDown={(e) => startDrag(e, "sw")} />
      <div className={`${handleStyle} -bottom-1.5 -right-1.5 cursor-se-resize`} onPointerDown={(e) => startDrag(e, "se")} />
    </div>
  );
}

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
const QUAD_SAMPLE = 360; // downscaled dim for 4-corner detection (quadrilateral fit)

type Pt = { x: number; y: number };

/**
 * Detect the 4 corners of the document by:
 * 1) Building a foreground mask (non-background pixels) on a downscaled image
 * 2) Finding the extreme points along 4 diagonal directions
 * Returns null if detection is unreliable (falls back to bbox crop).
 */
function detectDocumentQuad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { tl: Pt; tr: Pt; br: Pt; bl: Pt } | null {
  const scale = Math.min(1, QUAD_SAMPLE / Math.max(width, height));
  const sw = Math.max(64, Math.round(width * scale));
  const sh = Math.max(64, Math.round(height * scale));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;

  // Estimate background luminance from the 4 corner patches (12x12)
  const patch = 12;
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
        br += data[i]; bg += data[i + 1]; bb += data[i + 2]; bn++;
      }
    }
  }
  const bgLum = 0.299 * (br / bn) + 0.587 * (bg / bn) + 0.114 * (bb / bn);

  // Build foreground mask
  const mask = new Uint8Array(sw * sh);
  let count = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (Math.abs(lum - bgLum) > BG_THRESHOLD) {
        mask[y * sw + x] = 1;
        count++;
      }
    }
  }
  // Need a reasonable amount of foreground
  if (count < sw * sh * 0.05) return null;

  // Find extremes:
  // tl = min(x + y), tr = min(-x + y) = max(x - y) reversed, br = max(x + y), bl = max(-x + y) = min(x - y) inverted
  let tlScore = Infinity, brScore = -Infinity, trScore = -Infinity, blScore = Infinity;
  let tl: Pt = { x: 0, y: 0 };
  let tr: Pt = { x: sw - 1, y: 0 };
  let br_: Pt = { x: sw - 1, y: sh - 1 };
  let bl: Pt = { x: 0, y: sh - 1 };

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (!mask[y * sw + x]) continue;
      const sumA = x + y;
      if (sumA < tlScore) { tlScore = sumA; tl = { x, y }; }
      if (sumA > brScore) { brScore = sumA; br_ = { x, y }; }
      const diff = x - y;
      if (diff > trScore) { trScore = diff; tr = { x, y }; }
      if (diff < blScore) { blScore = diff; bl = { x, y }; }
    }
  }

  // Sanity: corners should not all be near the image edges (i.e., paper fills frame entirely)
  // Also verify the quad has a reasonable area
  const quadArea = polyArea([tl, tr, br_, bl]);
  if (quadArea < sw * sh * 0.15) return null;

  // Map back to original image pixel coordinates
  const map = (p: Pt): Pt => ({ x: (p.x / sw) * width, y: (p.y / sh) * height });
  return { tl: map(tl), tr: map(tr), br: map(br_), bl: map(bl) };
}

function polyArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Solve 8 unknowns of a 2D projective transform that maps 4 source points to a unit square (0..1, 0..1)
 * scaled to (outW, outH). Returns the inverse mapping coefficients for use in pixel-by-pixel sampling
 * (output -> source). We compute the forward H (src -> dst) and then invert by solving per-pixel:
 * actually we compute the *inverse* projective directly (dst -> src) by swapping point sets.
 */
function computeInverseProjective(
  srcCorners: { tl: Pt; tr: Pt; br: Pt; bl: Pt },
  dstW: number,
  dstH: number,
): number[] | null {
  // Map dst (rectangle) -> src (quad) so we can sample for each dst pixel
  const dst: Pt[] = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];
  const src: Pt[] = [srcCorners.tl, srcCorners.tr, srcCorners.br, srcCorners.bl];
  return solveHomography(dst, src);
}

/** Solve 3x3 homography H such that H * dst_i = src_i (in homogeneous coords), returning [h11..h32, 1]. */
function solveHomography(p1: Pt[], p2: Pt[]): number[] | null {
  // 8 equations, 8 unknowns
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = p1[i];
    const { x: u, y: v } = p2[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinearSystem(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Gaussian elimination for an n x n linear system A x = b. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Build augmented matrix
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // Pivot
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        maxRow = r;
      }
    }
    if (maxVal < 1e-10) return null;
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];
    // Eliminate
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  // Back-substitute
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Warp a quadrilateral region of the source canvas into a rectangular output canvas via projective transform + bilinear sampling. */
function warpPerspective(
  srcCtx: CanvasRenderingContext2D,
  srcW: number,
  srcH: number,
  quad: { tl: Pt; tr: Pt; br: Pt; bl: Pt },
  outW: number,
  outH: number,
): HTMLCanvasElement | null {
  const H = computeInverseProjective(quad, outW, outH);
  if (!H) return null;

  const srcImg = srcCtx.getImageData(0, 0, srcW, srcH).data;
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  const outImg = octx.createImageData(outW, outH);
  const od = outImg.data;

  const [h11, h12, h13, h21, h22, h23, h31, h32] = H;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const w = h31 * x + h32 * y + 1;
      const sx = (h11 * x + h12 * y + h13) / w;
      const sy = (h21 * x + h22 * y + h23) / w;
      const di = (y * outW + x) * 4;
      if (sx < 0 || sy < 0 || sx >= srcW - 1 || sy >= srcH - 1) {
        od[di] = 255; od[di + 1] = 255; od[di + 2] = 255; od[di + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const dx = sx - x0, dy = sy - y0;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + srcW * 4;
      const i11 = i01 + 4;
      // Bilinear interp per channel
      for (let c = 0; c < 3; c++) {
        const v00 = srcImg[i00 + c];
        const v10 = srcImg[i10 + c];
        const v01 = srcImg[i01 + c];
        const v11 = srcImg[i11 + c];
        const v0 = v00 * (1 - dx) + v10 * dx;
        const v1 = v01 * (1 - dx) + v11 * dx;
        od[di + c] = v0 * (1 - dy) + v1 * dy;
      }
      od[di + 3] = 255;
    }
  }
  octx.putImageData(outImg, 0, 0);
  return out;
}

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

    // Step 2: try to detect 4 document corners for perspective rectification
    const quad = detectDocumentQuad(fctx, full.width, full.height);

    let canvas: HTMLCanvasElement;
    let outW: number;
    let outH: number;
    let ctx: CanvasRenderingContext2D;

    if (quad) {
      // Step 3a: estimate target rectangle size from the longest opposite-edge averages
      const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
      const wTop = dist(quad.tl, quad.tr);
      const wBot = dist(quad.bl, quad.br);
      const hLeft = dist(quad.tl, quad.bl);
      const hRight = dist(quad.tr, quad.br);
      const targetW = Math.max(wTop, wBot);
      const targetH = Math.max(hLeft, hRight);
      const scale = Math.min(1, MAX_DIM / Math.max(targetW, targetH));
      outW = Math.max(1, Math.round(targetW * scale));
      outH = Math.max(1, Math.round(targetH * scale));
      const warped = warpPerspective(fctx, full.width, full.height, quad, outW, outH);
      if (warped) {
        canvas = warped;
        ctx = canvas.getContext("2d")!;
      } else {
        // Fallback to bbox crop if warp fails
        const bounds = detectContentBounds(fctx, full.width, full.height);
        const s = Math.min(1, MAX_DIM / Math.max(bounds.w, bounds.h));
        outW = Math.max(1, Math.round(bounds.w * s));
        outH = Math.max(1, Math.round(bounds.h * s));
        canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(full, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, outW, outH);
      }
    } else {
      // Fallback: simple bbox crop
      const bounds = detectContentBounds(fctx, full.width, full.height);
      const scale = Math.min(1, MAX_DIM / Math.max(bounds.w, bounds.h));
      outW = Math.max(1, Math.round(bounds.w * scale));
      outH = Math.max(1, Math.round(bounds.h * scale));
      canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, outW, outH);
    }

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

  // Cropper state — values are in *image pixel* coords (relative to page.dataUrl natural size)
  const [cropPageId, setCropPageId] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const [imgLayout, setImgLayout] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const cropPage = pages.find((p) => p.id === cropPageId) || null;

  // Initialize crop rect to full image when a new page is opened
  useEffect(() => {
    if (cropPage) {
      setCropRect({ x: 0, y: 0, w: cropPage.width, h: cropPage.height });
    } else {
      setCropRect(null);
      setImgLayout(null);
    }
  }, [cropPageId]);

  // Compute the displayed image rectangle inside the container (object-contain layout)
  const recomputeLayout = () => {
    const cont = cropContainerRef.current;
    if (!cont || !cropPage) return;
    const cw = cont.clientWidth;
    const ch = cont.clientHeight;
    const ratio = Math.min(cw / cropPage.width, ch / cropPage.height);
    const w = cropPage.width * ratio;
    const h = cropPage.height * ratio;
    setImgLayout({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h });
  };

  useEffect(() => {
    if (!cropPageId) return;
    recomputeLayout();
    const onResize = () => recomputeLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropPageId, cropPage?.width, cropPage?.height]);

  const applyCrop = async () => {
    if (!cropPage || !cropRect) { setCropPageId(null); return; }
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = cropPage.dataUrl;
      });
      const cx = Math.max(0, Math.round(cropRect.x));
      const cy = Math.max(0, Math.round(cropRect.y));
      const cw = Math.max(1, Math.min(cropPage.width - cx, Math.round(cropRect.w)));
      const ch = Math.max(1, Math.min(cropPage.height - cy, Math.round(cropRect.h)));
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const cctx = c.getContext("2d")!;
      cctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
      const dataUrl = c.toDataURL("image/jpeg", JPEG_QUALITY);
      setPages((prev) => prev.map((p) => p.id === cropPage.id ? { ...p, dataUrl, width: cw, height: ch } : p));
      setCropPageId(null);
      setCropRect(null);
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
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCropPageId(p.id)}>
                        <CropIcon className="h-3 w-3" />
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

      <Dialog open={!!cropPageId} onOpenChange={(v) => { if (!v) { setCropPageId(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Oříznout stránku</DialogTitle>
          </DialogHeader>
          <div
            ref={cropContainerRef}
            className="relative w-full h-[60vh] bg-muted rounded-md overflow-hidden select-none touch-none"
          >
            {cropPage && (
              <img
                ref={cropImgRef}
                src={cropPage.dataUrl}
                alt="Stránka k oříznutí"
                onLoad={recomputeLayout}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            )}
            {cropPage && cropRect && imgLayout && (
              <CropOverlay
                page={cropPage}
                rect={cropRect}
                setRect={setCropRect}
                imgLayout={imgLayout}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Táhněte rohy nebo hrany pro úpravu velikosti, klikněte dovnitř a táhněte pro posun.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cropPage && setCropRect({ x: 0, y: 0, w: cropPage.width, h: cropPage.height })}
            >
              Resetovat
            </Button>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCropPageId(null)}>
              Přeskočit
            </Button>
            <Button type="button" size="sm" onClick={applyCrop}>
              <Check className="h-4 w-4 mr-1" />
              Použít ořez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
