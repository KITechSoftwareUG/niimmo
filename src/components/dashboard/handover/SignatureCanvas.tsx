import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
  label: string;
}

export const SignatureCanvas = ({ onSignatureChange, label }: SignatureCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  // Stable ref so event listeners never need re-registration when prop changes
  const onSignatureChangeRef = useRef(onSignatureChange);
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scale canvas to device pixel ratio for sharp rendering on Retina/iPad displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#000000";

    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      if (window.TouchEvent && e instanceof TouchEvent) {
        // touches is empty on touchend → fall back to changedTouches
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return { x: 0, y: 0 };
        return { x: touch.clientX - r.left, y: touch.clientY - r.top };
      }
      const me = e as MouseEvent;
      return { x: me.clientX - r.left, y: me.clientY - r.top };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      // Prevent page scroll while signing — requires passive: false
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      // Draw a dot so a single tap is visible
      ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setHasSignature(true);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      onSignatureChangeRef.current(canvas.toDataURL("image/png"));
    };

    // Native listeners with { passive: false } so e.preventDefault() works on iOS Safari
    canvas.addEventListener("mousedown", startDrawing, { passive: false });
    canvas.addEventListener("mousemove", draw, { passive: false });
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
      canvas.removeEventListener("touchcancel", stopDrawing);
    };
  }, []); // Empty deps — canvas is stable, callback is accessed via ref

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChangeRef.current(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hasSignature && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSignature}
            className="h-8 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Neu
          </Button>
        )}
      </div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
        {/* No width/height attributes — set dynamically via DPR in useEffect */}
        <canvas
          ref={canvasRef}
          className="w-full h-[160px] cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">Hier unterschreiben</span>
          </div>
        )}
      </div>
    </div>
  );
};
