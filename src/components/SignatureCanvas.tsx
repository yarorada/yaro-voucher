import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

export function SignatureCanvas({ onSignatureChange, width = 500, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
  }, [width, height]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (isDrawing && hasDrawn) {
      onSignatureChange(canvasRef.current?.toDataURL("image/png") || null);
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white dark:bg-zinc-800">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: "none", cursor: "crosshair" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground/50 text-sm">Nakreslete podpis zde</p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-xs">
          <Eraser className="h-3 w-3 mr-1" /> Smazat podpis
        </Button>
      )}
    </div>
  );
}
