import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download, FileX, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { Document, Page, pdfjs } from 'react-pdf';

// Usar el mismo worker que signature-position-editor (funciona en Windows e iOS)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface DocumentPreviewModalProps {
  open: boolean;
  url: string; // Signed URL
  filename: string;
  mimeType?: string | null;
  onClose: () => void;
  docId?: number | null;
  onDelete?: (docId: number) => void;
}

export function DocumentPreviewModal({ open, url, filename, mimeType, onClose, docId, onDelete }: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<Uint8Array | null>(null);
  const [detectedMimeType, setDetectedMimeType] = useState<string | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfContainerWidth, setPdfContainerWidth] = useState<number>(800);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfPan, setPdfPan] = useState({ x: 0, y: 0 });
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const pdfDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);

  // Detect iOS - Safari on iOS doesn't support inline PDF viewing properly
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Memoize PDF file data to prevent unnecessary reloads
  const pdfFileData = useMemo(() => {
    if (!pdfArrayBuffer) return null;
    // Clone to prevent ArrayBuffer detached error
    return { data: pdfArrayBuffer.slice() };
  }, [pdfArrayBuffer]);

  // Memoize PDF options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    cMapPacked: false,
  }), []);
  
  
  // Update PDF container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (pdfContainerRef.current) {
        // En iOS, usar el viewport width en lugar de getBoundingClientRect
        // porque el contenedor puede tener dimensiones del canvas de fondo
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // El DialogContent usa w-[95vw], así que el ancho real es 95% del viewport
        const modalWidth = viewportWidth * 0.95;
        
        // Restar un poco de margen para padding del contenedor
        const width = modalWidth - 32;
        const newWidth = Math.max(width, 300); // minimum 300px
        
        console.log('[PDF Width iOS] Viewport:', viewportWidth, 'x', viewportHeight, 'Modal 95vw:', modalWidth, 'Final PDF width:', newWidth);
        setPdfContainerWidth(newWidth);
      }
    };
    
    // Initial update immediately (no delay for first render)
    updateWidth();
    
    // Multiple updates to catch iOS viewport changes
    const frameId1 = requestAnimationFrame(updateWidth);
    const frameId2 = requestAnimationFrame(() => {
      requestAnimationFrame(updateWidth);
    });
    
    // Delayed update for iOS Safari (sometimes needs extra time for viewport to settle)
    const timeoutId = setTimeout(updateWidth, 100);
    const timeoutId2 = setTimeout(updateWidth, 300);
    
    // Use ResizeObserver for better detection on iOS
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && pdfContainerRef.current) {
      resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(pdfContainerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    window.addEventListener('orientationchange', updateWidth);
    
    return () => {
      cancelAnimationFrame(frameId1);
      cancelAnimationFrame(frameId2);
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateWidth);
      window.removeEventListener('orientationchange', updateWidth);
    };
  }, [open]);

  // Auto-fit PDF to container width on first load (iOS fix)
  useEffect(() => {
    if (pdfArrayBuffer && pdfContainerWidth && pdfContainerWidth > 0) {
      console.log('[PDF Fit] Resetting zoom and pan. Container width:', pdfContainerWidth);
      // Reset pan and zoom when PDF loads or container width changes
      setPdfPan({ x: 0, y: 0 });
      setPdfZoom(1);
    }
  }, [pdfArrayBuffer, pdfContainerWidth]);

  useEffect(() => {
    if (open && url) {
      setLoading(true);
      setError(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setPdfZoom(1);
      setPdfPan({ x: 0, y: 0 });
      setBlobUrl(null);
      setPdfArrayBuffer(null);
      setPdfNumPages(null);
      setPdfPageNumber(1);
      setPdfLoadError(false);
      
      // Check if URL requires authentication (internal API endpoint)
      // Signed URLs (/api/documents/download/TOKEN) don't need auth - the token IS the auth
      const isSignedUrl = url.includes('/api/documents/download/');
      const requiresAuth = !isSignedUrl && (url.startsWith('/api/') || url.includes('/api/'));
      
      // For signed URLs and auth URLs, fetch the content
      if (requiresAuth || isSignedUrl) {
        // Download file (with or without authentication)
        const headers: HeadersInit = requiresAuth ? (getAuthHeaders() || {}) : {};
        fetch(url, { 
          method: 'GET',
          headers
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(res.status === 404 ? 'Documento no encontrado' : 'Error al cargar el documento');
            }
            const contentType = res.headers.get('content-type') || 'application/octet-stream';
            setDetectedMimeType(contentType);
            return res.blob();
          })
          .then(blob => {
            try {
              const type = blob.type.toLowerCase();
              setDetectedMimeType(blob.type);
              
              if (type.includes('pdf') && isIOS) {
                // For PDF on iOS: convert to ArrayBuffer for react-pdf (Safari no soporta PDFs en iframe)
                blob.arrayBuffer().then(arrayBuffer => {
                  const uint8Array = new Uint8Array(arrayBuffer);
                  setPdfArrayBuffer(uint8Array);
                  setLoading(false);
                }).catch(err => {
                  setError('Error al procesar el PDF');
                  setLoading(false);
                });
              } else {
                // For images and PDFs on desktop: create blob URL (usar visor nativo)
                const objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
                setLoading(false);
              }
            } catch (e) {
              setError('Error al procesar el archivo');
              setLoading(false);
            }
          })
          .catch(err => {
            setLoading(false);
            setError(err.message || 'No se pudo cargar el documento');
          });
      } else {
        // For external URLs (like signed R2 URLs), fetch to check if it's PDF on iOS
        if (isIOS) {
          fetch(url)
            .then(res => res.blob())
            .then(blob => {
              const type = blob.type.toLowerCase();
              setDetectedMimeType(blob.type);
              
              if (type.includes('pdf')) {
                // Convert to ArrayBuffer for iOS
                blob.arrayBuffer().then(arrayBuffer => {
                  const uint8Array = new Uint8Array(arrayBuffer);
                  setPdfArrayBuffer(uint8Array);
                  setLoading(false);
                }).catch(err => {
                  setError('Error al procesar el PDF');
                  setLoading(false);
                });
              } else {
                const objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
                setLoading(false);
              }
            })
            .catch(err => {
              setError('Error al cargar el archivo');
              setLoading(false);
            });
        } else {
          // Desktop: use URL directly
          setBlobUrl(url);
          setLoading(false);
        }
      }
    } else if (!open) {
      // Clean up blob URL when modal closes
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setError(null);
      setDetectedMimeType(null);
    }
  }, [open, url]);
  
  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const safeFilename = filename || '';

  const isImage = useMemo(() => {
    const type = (detectedMimeType || mimeType || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    if (type.includes('pdf')) return false;
    return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(safeFilename);
  }, [mimeType, detectedMimeType, safeFilename]);

  const isPdf = useMemo(() => {
    const type = (detectedMimeType || mimeType || '').toLowerCase();
    return type.includes('pdf') || safeFilename.toLowerCase().endsWith('.pdf');
  }, [mimeType, detectedMimeType, safeFilename]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.1));
  const handleZoomOut = () => setZoom((z) => Math.max(0.2, z - 0.1));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Clamp pan so we don't drag past the image bounds
  const clampPan = (nextPan: { x: number; y: number }) => {
    if (!imageSize || !containerRef.current || !imgRef.current) return nextPan;
    const container = containerRef.current.getBoundingClientRect();
    // Use the displayed size of the image (after max-w-full max-h-full)
    const displayedWidth = imgRef.current.clientWidth;
    const displayedHeight = imgRef.current.clientHeight;
    const scaledWidth = displayedWidth * zoom;
    const scaledHeight = displayedHeight * zoom;
    const maxX = Math.max(0, (scaledWidth - container.width) / 2);
    const maxY = Math.max(0, (scaledHeight - container.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nextPan.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPan.y)),
    };
  };

  const handleOpenNewTab = () => {
    // Use blob URL if available (for authenticated content)
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  const handleDownload = async () => {
    try {
      // If we already have a blob URL, use it directly
      if (blobUrl) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'document';
        a.click();
        return;
      }
      
      // Otherwise, fetch with authentication
      const authHeader = getAuthHeaders();
      const res = await fetch(url, {
        headers: authHeader || undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'document';
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      setError(e.message || 'No se pudo descargar el documento');
    }
  };

  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX - pan.x, y: clientY - pan.y };
  };

  const updateDrag = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;
    const next = {
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    };
    setPan(clampPan(next));
  };

  const endDrag = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    updateDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startDrag(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    updateDrag(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev));
  }, [zoom, imageSize]);

  // Gestión táctil para PDF en iOS
  const handlePdfTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Un dedo: arrastrar
      const touch = e.touches[0];
      setIsPdfDragging(true);
      pdfDragStartRef.current = { x: touch.clientX - pdfPan.x, y: touch.clientY - pdfPan.y };
    } else if (e.touches.length === 2) {
      // Dos dedos: zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastPinchDistanceRef.current = distance;
    }
  };

  const handlePdfTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPdfDragging && pdfDragStartRef.current) {
      // Arrastrar
      const touch = e.touches[0];
      setPdfPan({
        x: touch.clientX - pdfDragStartRef.current.x,
        y: touch.clientY - pdfDragStartRef.current.y,
      });
    } else if (e.touches.length === 2 && lastPinchDistanceRef.current) {
      // Zoom con pellizco
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const delta = distance / lastPinchDistanceRef.current;
      setPdfZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
      lastPinchDistanceRef.current = distance;
    }
  };

  const handlePdfTouchEnd = () => {
    setIsPdfDragging(false);
    pdfDragStartRef.current = null;
    lastPinchDistanceRef.current = null;
  };

  // Gestión con ratón para PDF en iOS escritorio (iPad con trackpad/ratón)
  const handlePdfMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Solo botón izquierdo
    setIsPdfDragging(true);
    pdfDragStartRef.current = { x: e.clientX - pdfPan.x, y: e.clientY - pdfPan.y };
  };

  const handlePdfMouseMove = (e: React.MouseEvent) => {
    if (!isPdfDragging || !pdfDragStartRef.current) return;
    setPdfPan({
      x: e.clientX - pdfDragStartRef.current.x,
      y: e.clientY - pdfDragStartRef.current.y,
    });
  };

  const handlePdfMouseUp = () => {
    setIsPdfDragging(false);
    pdfDragStartRef.current = null;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-3 md:px-4 py-2 md:py-3 border-b pr-10 md:pr-12 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            <DialogTitle className="truncate text-xs md:text-sm">{filename || 'Documento'}</DialogTitle>
            <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
              {isImage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomOut} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <ZoomOut className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetZoom} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <ZoomIn className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <Download className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                </>
              )}
              {/* Controles para PDF en iOS (react-pdf) */}
              {isPdf && pdfArrayBuffer && isIOS && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setPdfZoom(z => Math.max(0.5, z - 0.2))} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <ZoomOut className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setPdfZoom(1); setPdfPan({ x: 0, y: 0 }); }} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPdfZoom(z => Math.min(3, z + 0.2))} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <ZoomIn className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="h-6 w-6 md:h-7 md:w-7 p-0">
                    <Download className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                </>
              )}
              {/* Delete icon in modal header */}
              {typeof docId === 'number' && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(docId)}
                  className="h-6 w-6 md:h-7 md:w-7 p-0"
                  title="Eliminar documento"
                >
                  <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
              )}
              {/* External link button per requested style */}
              <button
                onClick={handleOpenNewTab}
                title="Abrir en nueva pestaña"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md h-6 w-6 md:h-7 md:w-7 p-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link h-3 w-3 md:h-3.5 md:w-3.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/50 relative overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
              <div className="text-center p-4 md:p-6 max-w-sm mx-4">
                <FileX className="w-12 h-12 md:w-16 md:h-16 mx-auto text-muted-foreground mb-3 md:mb-4" />
                <p className="text-base md:text-lg font-medium text-foreground mb-1 md:mb-2">No se puede mostrar</p>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">{error}</p>
                <Button variant="outline" onClick={onClose} size="sm">Cerrar</Button>
              </div>
            </div>
          )}

          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          )}

          {/* Viewer area - render when blob URL or PDF ArrayBuffer is ready */}
          {(blobUrl || pdfArrayBuffer) && !error && (
            isImage ? (
              <div
                ref={containerRef}
                className={`w-full h-full overflow-hidden flex items-center justify-center p-2 md:p-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={endDrag}
              >
                <img
                  ref={imgRef}
                  src={blobUrl ?? undefined}
                  alt={filename}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                    setLoading(false);
                    setPan({ x: 0, y: 0 });
                  }}
                  onError={() => setError('No se pudo cargar la imagen')}
                />
              </div>
            ) : isPdf ? (
              pdfArrayBuffer ? (
                // iOS: usar react-pdf porque Safari no soporta PDFs en iframe
                <div 
                  ref={pdfContainerRef} 
                  className={`w-full h-full overflow-hidden flex items-center justify-center relative ${isPdfDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  onTouchStart={handlePdfTouchStart}
                  onTouchMove={handlePdfTouchMove}
                  onTouchEnd={handlePdfTouchEnd}
                  onMouseDown={handlePdfMouseDown}
                  onMouseMove={handlePdfMouseMove}
                  onMouseUp={handlePdfMouseUp}
                  onMouseLeave={handlePdfMouseUp}
                  style={{
                    touchAction: 'none', // Prevenir scroll nativo
                    padding: 0, // Sin padding para cálculo exacto
                    margin: 0,
                  }}
                >
                  <div 
                    style={{
                      transform: `translate(${pdfPan.x}px, ${pdfPan.y}px) scale(${pdfZoom})`,
                      transformOrigin: 'center center',
                      transition: isPdfDragging ? 'none' : 'transform 0.1s ease-out',
                    }}
                  >
                    <Document
                      file={pdfFileData}
                      onLoadSuccess={({ numPages }) => {
                        console.log('[PDF Document] Loaded successfully. Pages:', numPages, 'Container width:', pdfContainerWidth);
                        setPdfNumPages(numPages);
                        setLoading(false);
                      }}
                      onLoadError={() => {
                        setPdfLoadError(true);
                        setError('No se pudo cargar el PDF');
                        setLoading(false);
                      }}
                      loading={<LoadingSpinner />}
                      options={pdfOptions}
                    >
                      <Page
                        pageNumber={pdfPageNumber}
                        width={pdfContainerWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={(page) => {
                          console.log('[PDF Page] Page rendered. Width:', page.width, 'Height:', page.height, 'Original size:', page.originalWidth, 'x', page.originalHeight, 'Container width:', pdfContainerWidth);
                          setLoading(false);
                        }}
                        onRenderError={() => {
                          setError('Error al renderizar la página');
                        }}
                      />
                    </Document>
                  </div>
                  {/* Controles de navegación de página para PDF en iOS */}
                  {pdfNumPages && pdfNumPages > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfPageNumber(p => Math.max(1, p - 1))}
                        disabled={pdfPageNumber <= 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[60px] text-center">
                        {pdfPageNumber} / {pdfNumPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfPageNumber(p => Math.min(pdfNumPages, p + 1))}
                        disabled={pdfPageNumber >= pdfNumPages}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : blobUrl ? (
                // Desktop: usar visor PDF nativo del navegador
                <iframe
                  ref={iframeRef}
                  src={blobUrl}
                  className="w-full h-full border-0"
                  title={filename}
                  onLoad={() => setLoading(false)}
                  onError={() => setError('No se pudo cargar el PDF')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <LoadingSpinner size="md" />
                    <p className="text-sm text-muted-foreground mt-3">Preparando PDF...</p>
                  </div>
                </div>
              )
            ) : null
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
