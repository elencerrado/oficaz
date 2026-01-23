#!/usr/bin/env node

/**
 * Script para convertir documentos Markdown legales a formato Word (.docx)
 * Convierte con estilos profesionales y formato adecuado para documentos legales
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, BorderStyle, convertInchesToTwip } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, 'docs', 'legal');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'legal', 'word');

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Función para limpiar markdown
function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '') // bold
    .replace(/\*/g, '') // italic
    .replace(/`/g, '') // code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // links
}

// Función para crear párrafo con formato
function createStyledParagraph(text, options = {}) {
  const {
    level = 'normal',
    bold = false,
    size = 11,
    spacing = 200,
  } = options;

  let indentation = {};
  if (level === 'h1') {
    return new Paragraph({
      text: cleanMarkdown(text),
      style: 'Heading1',
      spacing: { after: 400 },
      border: {
        bottom: {
          color: '000080',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    });
  } else if (level === 'h2') {
    return new Paragraph({
      text: cleanMarkdown(text),
      style: 'Heading2',
      spacing: { after: 300 },
    });
  } else if (level === 'h3') {
    return new Paragraph({
      text: cleanMarkdown(text),
      style: 'Heading3',
      spacing: { after: 200 },
    });
  }

  return new Paragraph({
    text: cleanMarkdown(text),
    run: new TextRun({
      size: size * 2,
      bold: bold,
    }),
    spacing: { after: spacing },
    alignment: 'justified',
  });
}

// Convertir markdown a documento Word
function convertMarkdownToWord(filePath, outputPath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const paragraphs = [];
    let i = 0;

    // Agregar cabecera
    paragraphs.push(
      new Paragraph({
        text: 'OFICAZ - SOFTWARE DE GESTIÓN LABORAL',
        alignment: 'center',
        run: new TextRun({
          bold: true,
          size: 24,
          color: '000080',
        }),
        spacing: { after: 400 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: 'Documentación Legal - Cumplimiento RGPD/LOPD España',
        alignment: 'center',
        run: new TextRun({
          size: 22,
          color: '666666',
        }),
        spacing: { after: 600 },
      })
    );

    // Procesar líneas
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        paragraphs.push(createStyledParagraph(line.replace('# ', ''), { level: 'h1' }));
      } else if (line.startsWith('## ')) {
        paragraphs.push(createStyledParagraph(line.replace('## ', ''), { level: 'h2' }));
      } else if (line.startsWith('### ')) {
        paragraphs.push(createStyledParagraph(line.replace('### ', ''), { level: 'h3' }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: cleanMarkdown(line.replace(/^[-*]\s+/, '')),
            bullet: {
              level: 0,
            },
            spacing: { after: 200 },
          })
        );
      } else if (line.trim() === '') {
        // Saltar líneas en blanco
      } else if (line.trim() === '---') {
        paragraphs.push(
          new Paragraph({
            border: {
              bottom: {
                color: '999999',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { after: 400 },
          })
        );
      } else if (line.trim() !== '') {
        // Párrafo normal
        paragraphs.push(
          new Paragraph({
            text: cleanMarkdown(line),
            spacing: { after: 200 },
            alignment: 'justified',
          })
        );
      }

      i++;
    }

    // Crear documento Word
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margins: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.25),
              },
            },
          },
          children: paragraphs,
        },
      ],
    });

    // Guardar documento
    Packer.toBuffer(doc).then((buffer) => {
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Convertido: ${path.basename(filePath)} → ${path.basename(outputPath)}`);
    });
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
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

console.log('🔄 Convirtiendo documentos a Word...\n');

mdFiles.forEach((file) => {
  const mdPath = path.join(DOCS_DIR, file);
  const wordPath = path.join(OUTPUT_DIR, file.replace('.md', '.docx'));

  if (fs.existsSync(mdPath)) {
    convertMarkdownToWord(mdPath, wordPath);
  } else {
    console.log(`⚠️ Archivo no encontrado: ${file}`);
  }
});

console.log('\n✅ Conversión completada. Documentos guardados en: docs/legal/word/');
