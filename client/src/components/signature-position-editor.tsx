import { useRef, useState, useEffect, useMemo } from 'react';
import { pdfjsLib } from '@/lib/pdf-worker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SignaturePositionEditorProps {
  pdfUrl: string;
  signaturePosition: { x: number; y: number; width: number; height: number; page: number } | null;
  onPositionChange: (position: { x: number; y: number; width: number; height: number; page: number }) => void;
  onClose: () => void;
  pdfFile?: File;
}

export function SignaturePositionEditor({
  pdfUrl,
  signaturePosition,
  onPositionChange,
  onClose,
  pdfFile
}: SignaturePositionEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0); // Reducir escala inicial para móvil
  const [initialScaleSet, setInitialScaleSet] = useState(false);
  const [autoScaleRef, setAutoScaleRef] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [isPanningPdf, setIsPanningPdf] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Detectar si es dispositivo móvil
  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
      (typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  // Para pinch zoom
  const [touchDistance, setTouchDistance] = useState(0);

  // Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        let pdfData: any;
        
        // If we have the actual file, use it directly - this is the preferred method
        if (pdfFile) {
          const arrayBuffer = await pdfFile.arrayBuffer();
          pdfData = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        } else if (pdfUrl) {
          try {
            const response = await fetch(pdfUrl, { 
              method: 'GET',
              headers: {
                'Accept': 'application/pdf'
              },
              credentials: pdfUrl.startsWith('/api/') ? 'include' : 'omit'
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            pdfData = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          } catch (fetchError: any) {
            console.error('Error cargando PDF:', fetchError);
            throw new Error('No se pudo cargar el PDF desde la URL');
          }
        } else {
          throw new Error('No PDF file or URL provided');
        }
        
        setPdfDoc(pdfData);
        setTotalPages(pdfData.numPages);
        setLoading(false);
      } catch (error: any) {
        console.error('Error en loadPdf:', error);
        toast({
          title: 'Error',
          description: error?.message || 'No se pudo cargar el PDF.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };
    
    if (pdfUrl || pdfFile) {
      loadPdf();
    }

    // Cleanup: revoke blob URL if it was created in admin-documents
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl, pdfFile, toast]);

  // Reset pan offset only when page changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [currentPage]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        
        // Calcular escala para ajustar al contenedor en móvil (solo para inicializar)
        const containerWidth = containerRef.current?.clientWidth || 400;
        const baseViewport = page.getViewport({ scale: 1 });
        const autoScale = containerWidth / baseViewport.width;
        setAutoScaleRef(autoScale);
        let finalScale = scale;
        if (isMobile && !initialScaleSet) {
          finalScale = autoScale * 0.9;
          // Guardamos esta escala como inicial y actualizamos estado
          setInitialScaleSet(true);
          if (Math.abs(scale - finalScale) > 0.001) {
            setScale(finalScale);
          }
        }
        
        const viewport = page.getViewport({ scale: finalScale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        setCanvasWidth(viewport.width);
        setCanvasHeight(viewport.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;
      } catch (error) {
        console.error('Render Error:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale, isMobile, initialScaleSet]);

  // Handle mouse down for both signature dragging and PDF panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signaturePosition || canvasWidth === 0) return;

    const overlayRect = overlayRef.current?.getBoundingClientRect();
    if (!overlayRect) return;
    
    const offsetX = e.clientX - overlayRect.left;
    const offsetY = e.clientY - overlayRect.top;

    // Check if clicking inside signature box
    const boxX = (signaturePosition.x / 100) * canvasWidth;
    const boxY = (signaturePosition.y / 100) * canvasHeight;
    const boxW = (signaturePosition.width / 100) * canvasWidth;
    const boxH = (signaturePosition.height / 100) * canvasHeight;

    if (
      offsetX >= boxX &&
      offsetX <= boxX + boxW &&
      offsetY >= boxY &&
      offsetY <= boxY + boxH
    ) {
      // Click is on signature box - drag signature
      setIsDraggingSignature(true);
      setDragOffset({
        x: offsetX - boxX,
        y: offsetY - boxY,
      });
    } else {
      // Click is on PDF - pan the PDF
      setIsPanningPdf(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  // Handle mouse move for both signature and PDF panning
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Dragging signature
    if (isDraggingSignature && signaturePosition && canvasWidth > 0) {
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!overlayRect) return;
      
      const offsetX = e.clientX - overlayRect.left;
      const offsetY = e.clientY - overlayRect.top;

      const newX = Math.max(
        0,
        Math.min(
          100 - signaturePosition.width,
          ((offsetX - dragOffset.x) / canvasWidth) * 100
        )
      );
      const newY = Math.max(
        0,
        Math.min(
          100 - signaturePosition.height,
          ((offsetY - dragOffset.y) / canvasHeight) * 100
        )
      );

      onPositionChange({
        ...signaturePosition,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
    }
    
    // Panning PDF
    if (isPanningPdf && containerRef.current) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      setPanOffset({
        x: panOffset.x + deltaX,
        y: panOffset.y + deltaY,
      });
      
      setPanStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDraggingSignature(false);
    setIsPanningPdf(false);
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.max(0.5, Math.min(3, scale + delta));
    
    setScale(newScale);
  };

  // Calcular distancia entre dos puntos (para pinch zoom)
  const getDistance = (p1: Touch, p2: Touch) => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start - detectar si es pinch zoom o pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const distance = getDistance(e.touches[0], e.touches[1]);
      setTouchDistance(distance);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!overlayRect || !signaturePosition) return;

      const offsetX = touch.clientX - overlayRect.left;
      const offsetY = touch.clientY - overlayRect.top;

      // Check if clicking inside signature box
      const boxX = (signaturePosition.x / 100) * canvasWidth;
      const boxY = (signaturePosition.y / 100) * canvasHeight;
      const boxW = (signaturePosition.width / 100) * canvasWidth;
      const boxH = (signaturePosition.height / 100) * canvasHeight;

      if (
        offsetX >= boxX &&
        offsetX <= boxX + boxW &&
        offsetY >= boxY &&
        offsetY <= boxY + boxH
      ) {
        setIsDraggingSignature(true);
        setDragOffset({
          x: offsetX - boxX,
          y: offsetY - boxY,
        });
      } else {
        setIsPanningPdf(true);
        setPanStart({
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    }
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const distance = getDistance(e.touches[0], e.touches[1]);
      if (touchDistance > 0) {
        const scale_delta = distance / touchDistance;
        const newScale = Math.max(0.5, Math.min(3, scale * scale_delta));
        setScale(newScale);
        setTouchDistance(distance);
      }
    } else if (e.touches.length === 1 && isDraggingSignature && signaturePosition && canvasWidth > 0) {
      // Dragging signature
      const touch = e.touches[0];
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!overlayRect) return;
      
      const offsetX = touch.clientX - overlayRect.left;
      const offsetY = touch.clientY - overlayRect.top;

      const newX = Math.max(
        0,
        Math.min(
          100 - signaturePosition.width,
          ((offsetX - dragOffset.x) / canvasWidth) * 100
        )
      );
      const newY = Math.max(
        0,
        Math.min(
          100 - signaturePosition.height,
          ((offsetY - dragOffset.y) / canvasHeight) * 100
        )
      );

      onPositionChange({
        ...signaturePosition,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
    } else if (e.touches.length === 1 && isPanningPdf) {
      // Panning PDF
      const touch = e.touches[0];
      if (containerRef.current) {
        const deltaX = touch.clientX - panStart.x;
        const deltaY = touch.clientY - panStart.y;
        
        setPanOffset({
          x: panOffset.x + deltaX,
          y: panOffset.y + deltaY,
        });
        
        setPanStart({
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    setTouchDistance(0);
    setIsDraggingSignature(false);
    setIsPanningPdf(false);
  };

  return (
    <div className={`flex h-full min-h-0 overflow-hidden gap-4 ${isMobile ? 'flex-col' : ''}`}>
      {/* PDF Viewer - Left Side / Top on Mobile */}
      <div className={`flex flex-col min-w-0 min-h-0 overflow-hidden ${isMobile ? 'w-full flex-1' : 'flex-1'}`}>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b flex-nowrap">
          <div className="flex items-center gap-2">
            <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="text-xs md:text-sm"
          >
            ← Ant
          </Button>
          <span className="text-xs md:text-sm whitespace-nowrap">
            {totalPages > 0 ? `${currentPage}/${totalPages}` : 'Cargando...'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="text-xs md:text-sm"
          >
            Sig →
          </Button>
          </div>

          <div className={`flex gap-1 md:gap-2 items-center flex-nowrap`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(Math.max(0.5, scale - 0.2))}
              className="text-xs"
            >
              −
            </Button>
            <span className="text-xs w-16 md:w-20 text-center whitespace-nowrap">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(Math.min(3, scale + 0.2))}
              className="text-xs"
            >
              +
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (autoScaleRef) {
                  setScale(Math.max(0.5, Math.min(3, autoScaleRef * 0.9)));
                  setInitialScaleSet(true);
                }
              }}
              title="Ajustar a ancho de página"
              className="text-xs hidden md:block"
            >
              Ajustar
            </Button>
          </div>
        </div>

        {/* PDF Canvas Container */}
        <div
          ref={containerRef}
          className={`flex-1 min-h-0 h-full overflow-hidden border rounded-lg bg-gray-100 dark:bg-gray-900 mt-4 flex items-center justify-center ${isMobile ? 'touch-none' : ''}`}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Cargando PDF...</p>
              </div>
            </div>
          ) : pdfDoc ? (
            <div 
              ref={overlayRef}
              className="relative inline-block"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                cursor: isPanningPdf ? 'grabbing' : isDraggingSignature ? 'grabbing' : 'grab',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isDraggingSignature || isPanningPdf ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <canvas
                ref={canvasRef}
                className="border block"
                style={{ display: 'block' }}
              />

              {/* Signature Box Overlay */}
              {signaturePosition && canvasWidth > 0 && (
                <div
                  className="absolute border-2 border-blue-500 hover:bg-blue-500/10 transition-colors pointer-events-auto"
                  style={{
                    left: `${(signaturePosition.x / 100) * canvasWidth}px`,
                    top: `${(signaturePosition.y / 100) * canvasHeight}px`,
                    width: `${(signaturePosition.width / 100) * canvasWidth}px`,
                    height: `${(signaturePosition.height / 100) * canvasHeight}px`,
                    cursor: 'grab'
                  }}
                >
                  {/* Upper part: Signature area */}
                  <div className="absolute inset-x-0 top-0 bg-blue-500/20 border-b border-blue-400 flex items-center justify-center" style={{ height: '60%' }}>
                    <div className="text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-300">Firma</div>
                  </div>

                  {/* Lower part: Date/Name area */}
                  <div className="absolute inset-x-0 bottom-0 bg-blue-500/10 flex flex-col items-center justify-center" style={{ height: '40%' }}>
                    <div className="text-xs md:text-sm text-blue-600 dark:text-blue-400 leading-tight text-center px-1">
                      <div className="text-[9px] md:text-xs">Fecha/Hora</div>
                      <div className="text-[9px] md:text-xs font-medium">Nombre</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No se pudo cargar el PDF</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls Panel - Right Side / Bottom on Mobile */}
      <div className={`${isMobile ? 'w-full border-t pt-4' : 'w-64 border-l pl-4'} space-y-4`}> 
        <h3 className="font-semibold text-sm md:text-base">Posición de Firma</h3>
        
        {/* Mobile hint removed as requested */}
        
        <div className="space-y-3">
          <div>
            <Label className="text-xs md:text-sm font-medium">
              X: {Math.round(signaturePosition?.x || 0)}%
            </Label>
            <Input
              type="range"
              min="0"
              max={String(100 - (signaturePosition?.width || 18))}
              step="1"
              value={Math.round(signaturePosition?.x || 0)}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (signaturePosition) {
                  onPositionChange({ ...signaturePosition, x: val });
                }
              }}
              className="w-full h-2"
            />
          </div>

          <div>
            <Label className="text-xs md:text-sm font-medium">
              Y: {Math.round(signaturePosition?.y || 0)}%
            </Label>
            <Input
              type="range"
              min="0"
              max={String(100 - (signaturePosition?.height || 15))}
              step="1"
              value={Math.round(signaturePosition?.y || 0)}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (signaturePosition) {
                  onPositionChange({ ...signaturePosition, y: val });
                }
              }}
              className="w-full h-2"
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Label className="text-xs md:text-sm font-medium">
            Escala: {signaturePosition ? Math.round((signaturePosition.width / 18) * 100) : 100}%
          </Label>
          
          {/* Fine-tuning slider */}
          <Input
            type="range"
            min="60"
            max="150"
            step="5"
            value={signaturePosition ? Math.round((signaturePosition.width / 18) * 100) : 100}
            onChange={(e) => {
              const percentage = Number(e.target.value);
              const baseWidth = 18;
              const baseHeight = 15;
              const width = (baseWidth * percentage) / 100;
              const height = (baseHeight * percentage) / 100;
              if (signaturePosition) {
                onPositionChange({ ...signaturePosition, width, height });
              }
            }}
            className="w-full h-2"
          />

          <p className="text-xs text-muted-foreground">
            {signaturePosition ? (Math.round(signaturePosition.width * 10) / 10) : 18}% × {signaturePosition ? (Math.round(signaturePosition.height * 10) / 10) : 15}%
          </p>
        </div>

        <div className={`pt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 ${isMobile ? 'flex gap-2' : ''}`}>
          <Button className={`${isMobile ? 'flex-1' : 'w-full'}`} onClick={onClose}>
            Confirmar
          </Button>
          
          <Button 
            variant="outline"
            className={`${isMobile ? 'flex-1' : 'w-full'}`}
            onClick={() => {
              if (signaturePosition) {
                onPositionChange({
                  x: 75,
                  y: 80,
                  width: 18,
                  height: 15,
                  page: 1
                });
              }
            }}
          >
            Restablecer
          </Button>
        </div>
      </div>
    </div>
  );
}
