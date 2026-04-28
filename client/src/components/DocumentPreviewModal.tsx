import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ModalActionButton } from '@/components/ui/modal-action-button';
import { ModalHeaderWithActions } from '@/components/ui/modal-header-with-actions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download, FileX, ChevronLeft, ChevronRight, Trash2, PenTool, X } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { Document, Page } from 'react-pdf';
import { pdfjsLib as pdfjs } from '@/lib/pdf-worker';

const detectMimeTypeFromBytes = async (blob: Blob, fallback?: string | null): Promise<string> => {
  const declared = (blob.type || fallback || '').toLowerCase();
  if (declared && declared !== 'application/octet-stream') {
    return declared;
  }

  try {
    const headerBuffer = await blob.slice(0, 16).arrayBuffer();
    const header = new Uint8Array(headerBuffer);

    // PDF: %PDF-
    if (
      header.length >= 5 &&
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46 &&
      header[4] === 0x2d
    ) {
      return 'application/pdf';
    }

    // PNG
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }

    // JPEG
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }

    // GIF
    if (header.length >= 3 && header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
      return 'image/gif';
    }

    // WEBP: RIFF....WEBP
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    // Keep fallback below
  }

  return declared || 'application/octet-stream';
};

interface DocumentPreviewModalProps {
  open: boolean;
  url: string; // Signed URL
  filename: string;
  mimeType?: string | null;
  onClose: () => void;
  docId?: number | null;
  onDelete?: (docId: number) => void;
  requiresSignature?: boolean; // If document requires signature
  isSigned?: boolean; // If document is already signed
  isViewed?: boolean; // If document has been viewed
  onSignClick?: () => void; // Callback when sign button is clicked
}

export function DocumentPreviewModal({ open, url, filename, mimeType, onClose, docId, onDelete, requiresSignature = false, isSigned = false, isViewed = false, onSignClick }: DocumentPreviewModalProps) {
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
  const [pdfContainerWidth, setPdfContainerWidth] = useState<number>(0);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfPan, setPdfPan] = useState({ x: 0, y: 0 });
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const pdfDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect iOS - Safari on iOS doesn't support inline PDF viewing properly
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Detect Android - also has issues with inline PDF viewing in many browsers
  const isAndroid = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android/.test(navigator.userAgent);
  }, []);

  // Use react-pdf for mobile devices (iOS and Android)
  const isMobile = isIOS || isAndroid;

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
        
        setPdfContainerWidth(newWidth);
      }
    };
    
    // Initial update immediately (no delay for first render)
    updateWidth();
    
    // Multiple updates to catch mobile viewport changes
    const frameId1 = requestAnimationFrame(updateWidth);
    const frameId2 = requestAnimationFrame(() => {
      requestAnimationFrame(updateWidth);
    });
    
    // Delayed update for mobile browsers (sometimes needs extra time for viewport to settle)
    const timeoutId = setTimeout(updateWidth, 100);
    const timeoutId2 = setTimeout(updateWidth, 300);
    
    // Use ResizeObserver for better detection on mobile
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
  }, [open, pdfArrayBuffer]); // Añadir pdfArrayBuffer para recalcular cuando se monte el contenedor PDF

  // Auto-fit PDF to container width on first load (iOS fix)
  // Estado para controlar si ya se hizo el reset inicial
  const [pdfInitialResetDone, setPdfInitialResetDone] = useState(false);
  
  // Reset flag cuando cambia el PDF
  useEffect(() => {
    if (pdfArrayBuffer) {
      setPdfInitialResetDone(false);
    }
  }, [pdfArrayBuffer]);

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
      lastTapTimeRef.current = 0;
      
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
            return res.blob();
          })
          .then(async (blob) => {
            try {
              const normalizedMimeType = await detectMimeTypeFromBytes(blob, mimeType || null);
              setDetectedMimeType(normalizedMimeType);
              const type = normalizedMimeType.toLowerCase();
              
              if (type.includes('pdf') && isMobile) {
                // For PDF on mobile (iOS/Android): convert to ArrayBuffer for react-pdf (mejor compatibilidad)
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
        // For external URLs (like signed R2 URLs), fetch to check if it's PDF on mobile
        if (isMobile) {
          fetch(url)
            .then(res => res.blob())
            .then(async (blob) => {
              const normalizedMimeType = await detectMimeTypeFromBytes(blob, mimeType || null);
              const type = normalizedMimeType.toLowerCase();
              setDetectedMimeType(normalizedMimeType);
              
              if (type.includes('pdf')) {
                // Convert to ArrayBuffer for mobile
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
          setDetectedMimeType(mimeType || null);
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
  }, [open, url, mimeType]);
  
  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      // Limpiar timeout de doble tap
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
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

  // Allow download/external open only if document doesn't require signature OR is already signed
  const allowDownloadAndExternal = !requiresSignature || isSigned;

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

  // Gestión táctil para PDF en móvil (iOS/Android)
  const handlePdfTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      
      // Detectar doble tap (menos de 300ms entre taps)
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        // Doble tap: ajustar documento (fit to screen)
        e.preventDefault();
        setPdfZoom(1);
        setPdfPan({ x: 0, y: 0 });
        lastTapTimeRef.current = 0;
        if (doubleTapTimeoutRef.current) {
          clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = null;
        }
      } else {
        // Primer tap o tap simple: iniciar arrastre después de un delay
        lastTapTimeRef.current = now;
        doubleTapTimeoutRef.current = setTimeout(() => {
          // Si no hubo segundo tap, iniciar arrastre
          setIsPdfDragging(true);
          pdfDragStartRef.current = { x: touch.clientX - pdfPan.x, y: touch.clientY - pdfPan.y };
        }, 300);
      }
    } else if (e.touches.length === 2) {
      // Dos dedos: zoom con pellizco
      // Cancelar cualquier detección de doble tap
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
        doubleTapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;
      
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
      // Arrastrar con un dedo
      e.preventDefault();
      const touch = e.touches[0];
      setPdfPan({
        x: touch.clientX - pdfDragStartRef.current.x,
        y: touch.clientY - pdfDragStartRef.current.y,
      });
    } else if (e.touches.length === 2 && lastPinchDistanceRef.current) {
      // Zoom con pellizco (dos dedos)
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Calcular el factor de zoom basado en la distancia entre dedos
      const delta = distance / lastPinchDistanceRef.current;
      setPdfZoom(prev => {
        const newZoom = prev * delta;
        // Limitar zoom entre 0.5x y 4x para mejor usabilidad
        return Math.max(0.5, Math.min(4, newZoom));
      });
      lastPinchDistanceRef.current = distance;
    }
  };

  const handlePdfTouchEnd = (e: React.TouchEvent) => {
    // Si se termina el gesto de pellizco o arrastre
    if (e.touches.length === 0) {
      setIsPdfDragging(false);
      pdfDragStartRef.current = null;
      lastPinchDistanceRef.current = null;
    } else if (e.touches.length === 1) {
      // Si queda un dedo, reiniciar arrastre
      lastPinchDistanceRef.current = null;
    }
  };

  // Gestión con ratón para PDF en móvil (tablets con trackpad/ratón)
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
      <DialogContent showCloseButton={false} className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <ModalHeaderWithActions
          title={filename || 'Documento'}
          titleClassName="text-xs md:text-sm"
          actions={(
            <>
              {isImage && (
                <>
                  <ModalActionButton intent="neutral" onClick={handleZoomOut} title="Reducir zoom">
                    <ZoomOut />
                  </ModalActionButton>
                  <ModalActionButton intent="neutral" onClick={handleResetZoom} title="Restablecer zoom">
                    <RotateCcw />
                  </ModalActionButton>
                  <ModalActionButton intent="neutral" onClick={handleZoomIn} title="Aumentar zoom">
                    <ZoomIn />
                  </ModalActionButton>
                  {allowDownloadAndExternal && (
                    <ModalActionButton intent="download" onClick={handleDownload} title="Descargar documento">
                      <Download />
                    </ModalActionButton>
                  )}
                </>
              )}
              {/* Controles para PDF en móvil (react-pdf) - solo descarga, zoom por gestos */}
              {isPdf && pdfArrayBuffer && isMobile && allowDownloadAndExternal && (
                <ModalActionButton intent="download" onClick={handleDownload} title="Descargar documento">
                  <Download />
                </ModalActionButton>
              )}
              {/* Delete icon in modal header */}
              {typeof docId === 'number' && onDelete && (
                <ModalActionButton
                  intent="delete"
                  onClick={() => onDelete(docId)}
                  title="Eliminar documento"
                >
                  <Trash2 />
                </ModalActionButton>
              )}
              {/* External link button - only if document doesn't require signature or is signed */}
              {allowDownloadAndExternal && (
                <ModalActionButton
                  intent="neutral"
                  onClick={handleOpenNewTab}
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink />
                </ModalActionButton>
              )}
              <ModalActionButton intent="neutral" onClick={onClose} title="Cerrar modal">
                <X />
              </ModalActionButton>
            </>
          )}
        />

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
                // Móvil (iOS/Android): usar react-pdf para mejor compatibilidad
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
                    {pdfContainerWidth > 0 ? (
                      <Document
                        file={pdfFileData}
                        onLoadSuccess={({ numPages }) => {
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
                          setLoading(false);
                          
                          // Reset zoom y pan DESPUÉS de renderizar la primera vez
                          if (!pdfInitialResetDone && pdfContainerWidth > 0) {
                            setPdfPan({ x: 0, y: 0 });
                            setPdfZoom(1);
                            setPdfInitialResetDone(true);
                          }
                        }}
                        onRenderError={() => {
                          setError('Error al renderizar la página');
                        }}
                      />
                    </Document>
                    ) : (
                      <LoadingSpinner />
                    )}
                  </div>
                  {/* Controles de navegación de página para PDF en móvil */}
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
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                  <FileX className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-base font-medium text-foreground mb-2">Vista previa no disponible</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Este archivo no se puede mostrar en el modal. Puedes abrirlo o descargarlo.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {allowDownloadAndExternal && (
                      <Button variant="outline" size="sm" onClick={handleOpenNewTab} className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Abrir
                      </Button>
                    )}
                    {allowDownloadAndExternal && (
                      <Button size="sm" onClick={handleDownload} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer con botón de firmar - solo para empleados con documentos que requieren firma */}
        {requiresSignature && !isSigned && isViewed && onSignClick && (
          <div className="border-t bg-background px-4 py-3 flex items-center justify-center flex-shrink-0">
            <Button
              onClick={onSignClick}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white shadow-md"
            >
              <PenTool className="h-4 w-4 mr-2" />
              Firmar Documento
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
