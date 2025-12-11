import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PenTool, RotateCcw, Check, X, Edit3, Info } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [showDrawMode, setShowDrawMode] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: signatureData, isLoading: signatureLoading } = useQuery<{ signatureUrl: string | null }>({
    queryKey: ['/api/work-reports/signature'],
    enabled: isOpen,
    staleTime: 30000
  });

  const savedSignatureUrl = signatureData?.signatureUrl;
  const hasSavedSignature = !!savedSignatureUrl;

  const saveSignatureMutation = useMutation({
    mutationFn: (signatureData: string) => 
      apiRequest('POST', '/api/work-reports/signature', { signatureData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-reports/signature'] });
      toast({
        title: 'Firma guardada',
        description: 'Tu firma se ha guardado y se usará para futuros documentos.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar firma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastPointRef.current = null;
        setHasDrawnSignature(false);
      }
    }
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        lastPointRef.current = null;
      }
    }
  }, []);

  const getEventPos = useCallback((event: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in event) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, []);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const { x, y } = getEventPos(event, canvas);
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

    const { x, y } = getEventPos(event, canvas);
    
    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastPointRef.current = { x, y };
    setHasDrawnSignature(true);
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

  const getOptimizedSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnSignature) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx] < 250 || data[idx + 1] < 250 || data[idx + 2] < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    const padding = 40;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const optimizedCanvas = document.createElement('canvas');
    const targetWidth = Math.min(800, width);
    const scale = targetWidth / width;
    optimizedCanvas.width = targetWidth;
    optimizedCanvas.height = height * scale;
    
    const optCtx = optimizedCanvas.getContext('2d');
    if (optCtx) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
        
        const imgData = tempCtx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 230 && g > 230 && b > 230) {
            pixels[i + 3] = 0;
          }
        }
        
        tempCtx.putImageData(imgData, 0, 0);
        
        optCtx.clearRect(0, 0, optimizedCanvas.width, optimizedCanvas.height);
        optCtx.imageSmoothingEnabled = true;
        optCtx.imageSmoothingQuality = 'high';
        optCtx.drawImage(tempCanvas, 0, 0, optimizedCanvas.width, optimizedCanvas.height);
      }
    }
    
    return optimizedCanvas.toDataURL('image/png');
  }, [hasDrawnSignature]);

  const handleSignWithSavedSignature = useCallback(async () => {
    if (!savedSignatureUrl) return;
    
    try {
      const response = await fetch(savedSignatureUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        onSign(base64data);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la firma guardada. Por favor, dibuja una nueva.',
        variant: 'destructive',
      });
      setShowDrawMode(true);
    }
  }, [savedSignatureUrl, onSign, toast]);

  const handleSignWithNewSignature = useCallback(() => {
    const signatureData = getOptimizedSignature();
    if (!signatureData) return;
    
    saveSignatureMutation.mutate(signatureData);
    onSign(signatureData);
  }, [getOptimizedSignature, onSign, saveSignatureMutation]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Setup canvas when draw mode is shown OR when there's no saved signature
  useEffect(() => {
    if (isOpen && !signatureLoading) {
      // Show draw mode if no saved signature exists
      const shouldShowDraw = showDrawMode || !hasSavedSignature;
      if (shouldShowDraw) {
        setTimeout(() => setupCanvas(), 100);
      }
    }
  }, [isOpen, showDrawMode, signatureLoading, hasSavedSignature, setupCanvas]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setShowDrawMode(false);
      setHasDrawnSignature(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderSavedSignatureView = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Confirma que has leído y aceptas el contenido del documento:</p>
        <p className="font-medium mt-1 text-gray-900 dark:text-gray-100 line-clamp-2">
          {documentName}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">Tu firma guardada:</p>
        <div className="relative border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4 flex items-center justify-center min-h-[120px]">
          <img 
            src={savedSignatureUrl!} 
            alt="Tu firma" 
            className="max-h-24 max-w-full object-contain dark:invert dark:brightness-90"
          />
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Se registrará la fecha, hora y tu firma para este documento. Esta acción confirma tu aceptación del contenido.
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 pt-2">
        <Button
          type="button"
          onClick={handleSignWithSavedSignature}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <LoadingSpinner size="xs" className="mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Firmando...' : 'Firmar con esta firma'}
        </Button>
        
        <div className="flex gap-2">
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
            variant="outline"
            onClick={() => setShowDrawMode(true)}
            disabled={isLoading}
            className="flex-1"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Dibujar nueva
          </Button>
        </div>
      </div>
    </div>
  );

  const renderDrawSignatureView = () => (
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
          <p className="text-sm font-medium">
            {hasSavedSignature ? 'Dibuja tu nueva firma:' : 'Dibuja tu firma:'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={!hasDrawnSignature}
            className="h-8 px-3 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        </div>
        
        <div className="relative border rounded-lg bg-white border-gray-300 dark:border-gray-600">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full h-40 touch-none cursor-crosshair rounded-lg"
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
          {!hasDrawnSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm">
                Usa tu dedo o ratón para firmar aquí
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Esta firma se guardará en tu perfil y se usará para firmar futuros documentos.
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => hasSavedSignature ? setShowDrawMode(false) : onClose()}
            disabled={isLoading || saveSignatureMutation.isPending}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {hasSavedSignature ? 'Volver' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            onClick={handleSignWithNewSignature}
            disabled={!hasDrawnSignature || isLoading || saveSignatureMutation.isPending}
            className="flex-1"
          >
            {(isLoading || saveSignatureMutation.isPending) ? (
              <LoadingSpinner size="xs" className="mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {(isLoading || saveSignatureMutation.isPending) ? 'Guardando...' : 'Guardar y Firmar'}
          </Button>
        </div>
      </div>
    </div>
  );

  // Custom overlay without any CSS transforms
  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <PenTool className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Firmar Documento</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {signatureLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          hasSavedSignature && !showDrawMode 
            ? renderSavedSignatureView() 
            : renderDrawSignatureView()
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
