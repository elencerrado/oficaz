#!/usr/bin/env node

/**
 * Conversión simple y confiable de Markdown a Word
 * Usando estructura DOCX XML válida
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, 'docs', 'legal');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'legal', 'word');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Función para escapar XML
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convertir Markdown a XML de Word
function markdownToWordXml(mdContent) {
  let content = mdContent;

  // Dividir en líneas
  let lines = content.split('\n');
  let wordContent = '';

  for (let line of lines) {
    line = line.trim();

    if (!line) {
      wordContent += '<w:p></w:p>';
    } else if (line.startsWith('# ')) {
      const text = escapeXml(line.replace('# ', ''));
      wordContent += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="56"/><w:color w:val="000080"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
    } else if (line.startsWith('## ')) {
      const text = escapeXml(line.replace('## ', ''));
      wordContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="4472C4"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
    } else if (line.startsWith('### ')) {
      const text = escapeXml(line.replace('### ', ''));
      wordContent += `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="4472C4"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
    } else if (line.match(/^[-*✅]/)) {
      let text = line.replace(/^[-*✅]\s+/, '');
      // Procesar bold y otros estilos
      text = processTextStyles(text);
      wordContent += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
    } else {
      let text = processTextStyles(line);
      wordContent += `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
    }
  }

  return wordContent;
}

// Procesar estilos de texto
function processTextStyles(text) {
  text = escapeXml(text);
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<w:r><w:rPr><w:i/></w:rPr><w:t>$1</w:t></w:r>');
  return `<w:r><w:t>${text}</w:t></w:r>`;
}

// Crear documento Word
function createWordDocument(mdPath, docxPath) {
  return new Promise((resolve, reject) => {
    try {
      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      const fileName = path.basename(mdPath, '.md');
      const wordXml = markdownToWordXml(mdContent);

      // XML del documento
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Normal"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="52"/><w:color w:val="000080"/></w:rPr><w:t>OFICAZ</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="28"/><w:color w:val="4472C4"/></w:rPr><w:t>Software de Gestión Laboral</w:t></w:r>
    </w:p>
    <w:p/>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="000080"/></w:rPr><w:t>${fileName.replace(/_/g, ' ').toUpperCase()}</w:t></w:r>
    </w:p>
    <w:p/>
    ${wordXml}
    <w:p><w:pPr><w:spacing w:before="600"/></w:pPr></w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>____________________________</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>José Ángel García Márquez</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="666666"/></w:rPr><w:t>DNI: 09055639X | Responsable Único de Oficaz</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

      // XML de relaciones
      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

      // XML de estilos
      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr><w:color w:val="000080"/><w:b/><w:sz w:val="56"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:color w:val="4472C4"/><w:b/><w:sz w:val="48"/></w:rPr>
  </w:style>
</w:styles>`;

      // Content Types XML
      const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

      // Crear ZIP (DOCX)
      const output = createWriteStream(docxPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`✅ ${path.basename(docxPath)}`);
        resolve();
      });

      archive.on('error', (err) => {
        console.error(`❌ Error en ${path.basename(docxPath)}: ${err.message}`);
        reject(err);
      });

      archive.pipe(output);

      // Agregar archivos al ZIP
      archive.append('[Content_Types].xml', { name: '[Content_Types].xml' });
      archive.append(contentTypesXml, { name: '[Content_Types].xml' });
      archive.append(relsXml, { name: '_rels/.rels' });
      archive.append(documentXml, { name: 'word/document.xml' });
      archive.append(stylesXml, { name: 'word/styles.xml' });
      archive.append('', { name: '_rels/.rels' });

      archive.finalize();
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      reject(error);
    }
  });
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

console.log('\n📄 Creando documentos Word desde cero...\n');

// Limpiar directorio
if (fs.existsSync(OUTPUT_DIR)) {
  fs.readdirSync(OUTPUT_DIR).forEach((file) => {
    if (file.endsWith('.docx')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  });
}

// Procesar secuencialmente
(async () => {
  for (const file of mdFiles) {
    const mdPath = path.join(DOCS_DIR, file);
    const docxPath = path.join(OUTPUT_DIR, file.replace('.md', '.docx'));
    
    if (fs.existsSync(mdPath)) {
      await createWordDocument(mdPath, docxPath);
    }
  }
  console.log('\n✅ Documentos creados correctamente\n');
})();
