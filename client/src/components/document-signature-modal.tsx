import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PenTool, RotateCcw, Check, X } from 'lucide-react';

interface DocumentSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (signature: string) => void;
  documentName: string;
  isLoading?: boolean;
}

export function DocumentSignatureModal({
  isOpen,
  onClose,
  onSign,
  documentName,
  isLoading = false
}: DocumentSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill with white background for clean signature
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastPointRef.current = null;
        setHasSignature(false);
      }
    }
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High quality canvas setup - same as work reports
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Scale canvas for HiDPI displays
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        ctx.scale(dpr, dpr);
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, rect.width, rect.height);
        
        // High quality drawing style - matching work reports
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 5; // Thicker line for better visibility
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        lastPointRef.current = null;
      }
    }
  }, []);

  const getEventPos = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;

    if ('touches' in event) {
      clientX = event.touches[0]?.clientX || 0;
      clientY = event.touches[0]?.clientY || 0;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Return coordinates in CSS units (context is already scaled by DPR)
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const { x, y } = getEventPos(event);
    lastPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getEventPos]);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getEventPos(event);
    
    // Use quadratic curves for smoother lines - same as work reports
    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastPointRef.current = { x, y };
    setHasSignature(true);
  }, [isDrawing, getEventPos]);

  const stopDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (isDrawing && lastPointRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [isDrawing]);

  const handleSign = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    // Optimize signature: create a smaller canvas with the signature cropped to content
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get image data to find signature bounds
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    
    // Find bounds of non-white pixels
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        // Check if pixel is not white (has signature content)
        if (data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    // Add padding around signature
    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Create optimized canvas with cropped signature
    const optimizedCanvas = document.createElement('canvas');
    const targetWidth = Math.min(400, width); // Max 400px wide
    const scale = targetWidth / width;
    optimizedCanvas.width = targetWidth;
    optimizedCanvas.height = height * scale;
    
    const optCtx = optimizedCanvas.getContext('2d');
    if (optCtx) {
      optCtx.fillStyle = 'white';
      optCtx.fillRect(0, 0, optimizedCanvas.width, optimizedCanvas.height);
      optCtx.imageSmoothingEnabled = true;
      optCtx.imageSmoothingQuality = 'high';
      optCtx.drawImage(
        canvas, 
        minX, minY, width, height,
        0, 0, optimizedCanvas.width, optimizedCanvas.height
      );
    }
    
    // Convert to optimized PNG with good quality
    const signatureData = optimizedCanvas.toDataURL('image/png', 0.9);
    onSign(signatureData);
  }, [hasSignature, onSign]);

  useEffect(() => {
    if (isOpen) {
      setupCanvas();
    }
  }, [isOpen, setupCanvas]);

  // Prevent default touch behaviors on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e: Event) => e.preventDefault();
    
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchend', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchend', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <PenTool className="h-5 w-5" />
            Firmar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>Confirma que has leído y aceptas el contenido del documento:</p>
            <p className="font-medium mt-1 text-gray-900 dark:text-gray-100 line-clamp-2">
              {documentName}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Dibuja tu firma:</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCanvas}
                disabled={!hasSignature}
                className="h-8 px-3 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            </div>
            
            <div className="relative border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <canvas
                ref={canvasRef}
                className="w-full h-32 sm:h-40 touch-none cursor-crosshair"
                style={{ 
                  touchAction: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400 text-xs sm:text-sm">
                    Usa tu dedo o stylus para firmar aquí
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSign}
              disabled={!hasSignature || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Firmando...' : 'Firmar y Aceptar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}