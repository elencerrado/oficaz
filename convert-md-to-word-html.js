#!/usr/bin/env node

/**
 * Conversión robusta de Markdown a Word usando HTML como intermediario
 * Esto garantiza mejor compatibilidad y preservación de contenido
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar la librería html-docx
const { asDocument } = await import('html-docx-js');

const DOCS_DIR = path.join(__dirname, 'docs', 'legal');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'legal', 'word');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Función para convertir Markdown a HTML
function markdownToHtml(mdContent) {
  let html = mdContent;

  // Títulos
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Viñetas
  html = html.replace(/^[-*✅] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/li>\n<li>/g, '</li><li>');

  // Líneas en blanco
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Saltos de línea
  html = html.replace(/\n/g, '<br>');

  // Estilos CSS
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Calibri, Arial, sans-serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #333333;
        }
        h1 {
          font-size: 28pt;
          color: #000080;
          font-weight: bold;
          margin-top: 20px;
          margin-bottom: 15px;
          border-bottom: 2px solid #4472C4;
          padding-bottom: 10px;
        }
        h2 {
          font-size: 20pt;
          color: #4472C4;
          font-weight: bold;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        h3 {
          font-size: 14pt;
          color: #4472C4;
          font-weight: bold;
          margin-top: 10px;
          margin-bottom: 8px;
        }
        p {
          text-align: justify;
          margin-bottom: 12px;
        }
        ul {
          margin-left: 20px;
          margin-bottom: 12px;
        }
        li {
          margin-bottom: 6px;
        }
        strong {
          font-weight: bold;
        }
        em {
          font-style: italic;
        }
        code {
          background-color: #f0f0f0;
          padding: 2px 4px;
          font-family: 'Courier New', monospace;
        }
        a {
          color: #0563C1;
          text-decoration: underline;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .title {
          font-size: 24pt;
          color: #000080;
          font-weight: bold;
          margin: 20px 0;
        }
        .subtitle {
          font-size: 14pt;
          color: #666666;
          font-style: italic;
          margin-bottom: 30px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <p style="font-size: 24pt; font-weight: bold; color: #000080; margin: 20px 0;">OFICAZ</p>
        <p style="font-size: 16pt; color: #4472C4; margin: 10px 0;">Software de Gestión Laboral</p>
      </div>
      ${html}
      <hr style="margin-top: 40px; border: 1px solid #999;">
      <p style="text-align: center; margin-top: 30px; font-weight: bold;">José Ángel García Márquez</p>
      <p style="text-align: center; font-size: 10pt; color: #666666;">DNI: 09055639X | Responsable Único de Oficaz</p>
    </body>
    </html>
  `;

  return styledHtml;
}

// Función para convertir archivo
async function convertFile(mdPath, docxPath) {
  try {
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const htmlContent = markdownToHtml(mdContent);

    // Generar documento Word
    const doc = asDocument(htmlContent);
    
    fs.writeFileSync(docxPath, doc);
    console.log(`✅ ${path.basename(docxPath)}`);
  } catch (error) {
    console.error(`❌ Error: ${path.basename(mdPath)} - ${error.message}`);
  }
}

// Archivos a convertir
const mdFiles = [
  'POLITICA_PRIVACIDAD.md',
  'CONTRATO_ENCARGO_TRATAMIENTO.md',
  'REGISTRO_ACTIVIDADES_TRATAMIENTO.md',
  'PROCEDIMIENTO_BRECHAS_SEGURIDAD.md',
  'ANALISIS_RIESGOS.md',
  'MEDIDAS_SEGURIDAD.md',
  'CLAUSULAS_INFORMATIVAS_TRABAJADORES.md',
];

console.log('\n📄 Convirtiendo documentos Markdown a Word...\n');

// Limpiar directorio
if (fs.existsSync(OUTPUT_DIR)) {
  fs.readdirSync(OUTPUT_DIR).forEach((file) => {
    if (file.endsWith('.docx')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  });
}

// Procesar archivos secuencialmente
for (const file of mdFiles) {
  const mdPath = path.join(DOCS_DIR, file);
  const docxPath = path.join(OUTPUT_DIR, file.replace('.md', '.docx'));
  
  if (fs.existsSync(mdPath)) {
    await convertFile(mdPath, docxPath);
  } else {
    console.log(`⚠️ ${file} no encontrado`);
  }
}

console.log('\n✅ Conversión completada.\n');
