import { pdfjs as pdfjsLib } from 'react-pdf';

const syncedWorkerVersion = '5.4.296';
const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${baseOrigin}/pdf.worker.min.mjs?v=${syncedWorkerVersion}`;

export { pdfjsLib };
