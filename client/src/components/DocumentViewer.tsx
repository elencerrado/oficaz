import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, Download, FileX, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { Document, Page, pdfjs } from 'react-pdf';

// Use local worker to satisfy CSP
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface DocumentViewerProps {
  url: string; // Signed URL or blob URL
  filename: string;
  mimeType?: string | null;
  className?: string;
  showControls?: boolean;
}

export function DocumentViewer({ url, filename, mimeType, className = '', showControls = true }: DocumentViewerProps) {
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
  const [detectedMimeType, setDetectedMimeType] = useState<string | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfContainerWidth, setPdfContainerWidth] = useState<number>(800);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Detect iOS - Safari on iOS doesn't support inline PDF viewing properly
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Memoize PDF options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    cMapPacked: false,
  }), []);
  
  // Update PDF container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (pdfContainerRef.current) {
        const width = pdfContainerRef.current.clientWidth - 32; // padding
        setPdfContainerWidth(Math.max(width, 300)); // minimum 300px
      }
    };
    
    // Initial update with a small delay to ensure container is rendered
    const timer = setTimeout(updateWidth, 100);
    updateWidth();
    
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [url]);

  useEffect(() => {
    if (url) {
      setLoading(true);
      setError(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setBlobUrl(null);
      setPdfNumPages(null);
      setPdfPageNumber(1);
      setPdfLoadError(false);
      
      // Check if URL requires authentication (internal API endpoint)
      const isSignedUrl = url.includes('/api/documents/download/');
      const isBlobUrl = url.startsWith('blob:');
      const isDataUrl = url.startsWith('data:');
      const requiresAuth = !isSignedUrl && !isBlobUrl && !isDataUrl && (url.startsWith('/api/') || url.includes('/api/'));
      
      // For blob URLs or data URLs, use directly
      if (isBlobUrl || isDataUrl) {
        setBlobUrl(url);
        setDetectedMimeType(mimeType || null);
        setLoading(false);
        return;
      }
      
      // For signed URLs and auth URLs, fetch the content
      if (requiresAuth || isSignedUrl) {
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
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
            setLoading(false);
          })
          .catch(err => {
            setError(err.message || 'Error al cargar el documento');
            setLoading(false);
          });
      } else {
        // For external URLs, use directly
        setBlobUrl(url);
        setDetectedMimeType(mimeType || null);
        setLoading(false);
      }
    }
  }, [url, mimeType]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:') && blobUrl !== url) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl, url]);

  const finalMimeType = detectedMimeType || mimeType || '';
  const isImage = useMemo(() => {
    if (!blobUrl) return false;
    const mime = finalMimeType.toLowerCase();
    const isImageMime = mime.startsWith('image/');
    const hasImageExt = /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(filename);
    return isImageMime || hasImageExt;
  }, [blobUrl, finalMimeType, filename]);

  const isPdf = useMemo(() => {
    if (!blobUrl) return false;
    const mime = finalMimeType.toLowerCase();
    const isPdfMime = mime.includes('pdf');
    const hasPdfExt = filename.toLowerCase().endsWith('.pdf');
    return isPdfMime || hasPdfExt;
  }, [blobUrl, finalMimeType, filename]);

  const clampPan = (nextPan: { x: number; y: number }) => {
    if (!containerRef.current || !imageSize || zoom <= 1) {
      return { x: 0, y: 0 };
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaledWidth = imageSize.width * zoom;
    const scaledHeight = imageSize.height * zoom;
    
    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
    
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, nextPan.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, nextPan.y)),
    };
  };

  const handleZoomIn = () => {
    setZoom(z => Math.min(3, z + 0.2));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(0.2, z - 0.2));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank');
  };

  const handleDownload = async () => {
    try {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'document';
        a.click();
        return;
      }
      
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

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls header */}
      {showControls && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {filename}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isImage && (
              <>
                <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-8 w-8 p-0" title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleResetZoom} className="h-8 w-8 p-0" title="Restaurar zoom">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-8 w-8 p-0" title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1" />
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleDownload} className="h-8 w-8 p-0" title="Descargar">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenNewTab} className="h-8 w-8 p-0" title="Abrir en nueva pestaña">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Viewer area */}
      <div className="flex-1 bg-muted/50 relative overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <div className="text-center p-6">
              <FileX className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )}

        {!loading && !error && blobUrl && isImage && (
          <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onMouseDown={zoom > 1 ? handleMouseDown : undefined}
            onMouseMove={zoom > 1 ? handleMouseMove : undefined}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={zoom > 1 ? handleTouchStart : undefined}
            onTouchMove={zoom > 1 ? handleTouchMove : undefined}
            onTouchEnd={endDrag}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              ref={imgRef}
              src={blobUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            />
          </div>
        )}

        {!loading && !error && blobUrl && isPdf && (
          <div ref={pdfContainerRef} className="w-full h-full flex flex-col">
            {isIOS ? (
              pdfLoadError ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                  <div>
                    <FileX className="h-12 w-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-base font-semibold mb-2">No se puede mostrar el PDF</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Este dispositivo no soporta vista previa de PDF
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button onClick={handleOpenNewTab} className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Abrir
                      </Button>
                      <Button variant="outline" onClick={handleDownload} className="gap-2">
                        <Download className="w-4 h-4" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-auto">
                  <Document
                    file={blobUrl}
                    onLoadSuccess={({ numPages }) => setPdfNumPages(numPages)}
                    onLoadError={() => setPdfLoadError(true)}
                    loading={<div className="flex items-center justify-center p-8"><LoadingSpinner /></div>}
                    className="flex-1 flex flex-col items-center py-4"
                    options={pdfOptions}
                  >
                    <Page
                      pageNumber={pdfPageNumber}
                      width={Math.min(pdfContainerWidth, 800)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-lg rounded"
                    />
                  </Document>
                  
                  {pdfNumPages && pdfNumPages > 1 && (
                    <div className="flex items-center justify-center gap-4 py-3 border-t bg-background">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfPageNumber(p => Math.max(1, p - 1))}
                        disabled={pdfPageNumber <= 1}
                        className="gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {pdfPageNumber} / {pdfNumPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfPageNumber(p => Math.min(pdfNumPages!, p + 1))}
                        disabled={pdfPageNumber >= pdfNumPages}
                        className="gap-1"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <iframe
                ref={iframeRef}
                src={blobUrl}
                className="w-full h-full border-0"
                title={filename}
              />
            )}
          </div>
        )}

        {!loading && !error && blobUrl && !isImage && !isPdf && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6">
              <FileX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Vista previa no disponible para este tipo de archivo
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleOpenNewTab} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Abrir
                </Button>
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
