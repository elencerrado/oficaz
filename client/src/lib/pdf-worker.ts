// Importar pdfjs desde react-pdf para asegurar consistencia de versiones
// react-pdf usa pdfjs-dist@5.4.296 internamente
import { pdfjs as pdfjsLib } from 'react-pdf';

// Use worker from public folder to satisfy CSP (same-origin)
// El worker sincronizado es de la misma versión que react-pdf usa
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export { pdfjsLib };
