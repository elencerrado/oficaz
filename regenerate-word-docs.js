#!/usr/bin/env node

/**
 * Script mejorado para convertir Markdown a Word con mejor validación
 * Utiliza un enfoque más simple y probado
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, BorderStyle, convertInchesToTwip, PageBreak, AlignmentType } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, 'docs', 'legal');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'legal', 'word');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Colores corporativos
const COLORS = {
  primary: '000080',
  secondary: '4472C4',
  text: '333333',
};

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^\*]+)\*\*/g, '$1')
    .replace(/\*([^\*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^#+\s+/, '');
}

function createParagraph(text, style = 'normal', level = 0) {
  const cleanedText = cleanText(text);
  
  if (!cleanedText.trim()) {
    return new Paragraph({
      text: '',
      spacing: { after: 200 },
    });
  }

  let run = new TextRun({
    size: 22,
    color: COLORS.text,
    name: 'Calibri',
  });

  let spacing = { after: 200 };
  let alignment = AlignmentType.JUSTIFIED;

  if (style === 'h1') {
    run = new TextRun({
      bold: true,
      size: 28,
      color: COLORS.primary,
      name: 'Calibri',
    });
    spacing = { before: 400, after: 300 };
  } else if (style === 'h2') {
    run = new TextRun({
      bold: true,
      size: 24,
      color: COLORS.secondary,
      name: 'Calibri',
    });
    spacing = { before: 300, after: 200 };
  } else if (style === 'h3') {
    run = new TextRun({
      bold: true,
      size: 22,
      color: COLORS.secondary,
      name: 'Calibri',
    });
    spacing = { before: 200, after: 150 };
  } else if (style === 'bullet') {
    spacing = { after: 150 };
  }

  return new Paragraph({
    text: cleanedText,
    run: run,
    spacing: spacing,
    alignment: alignment,
    bullet: style === 'bullet' ? { level: level } : undefined,
    indent: style === 'bullet' ? { left: 720, hanging: 360 } : undefined,
  });
}

function convertMarkdownToWord(mdPath, docxPath) {
  try {
    const content = fs.readFileSync(mdPath, 'utf-8');
    const lines = content.split('\n');
    const paragraphs = [];

    // Portada
    const fileName = path.basename(mdPath, '.md');
    const docTitle = fileName
      .replace(/_/g, ' ')
      .toUpperCase();

    paragraphs.push(
      new Paragraph({
        text: 'OFICAZ',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          bold: true,
          size: 52,
          color: COLORS.primary,
          name: 'Calibri',
        }),
        spacing: { before: 800, after: 200 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: 'Software de Gestión Laboral',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          size: 28,
          color: COLORS.secondary,
          name: 'Calibri',
        }),
        spacing: { after: 600 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: docTitle,
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          bold: true,
          size: 32,
          color: COLORS.primary,
          name: 'Calibri',
        }),
        spacing: { before: 400, after: 400 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: 'Responsable: José Ángel García Márquez (DNI: 09055639X)',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          size: 20,
          color: '666666',
          italics: true,
          name: 'Calibri',
        }),
        spacing: { after: 600 },
      })
    );

    paragraphs.push(new PageBreak());

    // Procesar contenido
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) {
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(createParagraph(line.slice(2), 'h1'));
      } else if (line.startsWith('## ')) {
        paragraphs.push(createParagraph(line.slice(3), 'h2'));
      } else if (line.startsWith('### ')) {
        paragraphs.push(createParagraph(line.slice(4), 'h3'));
      } else if (line.match(/^\s*[-*✅]/)) {
        const bulletText = line.replace(/^\s*[-*✅]\s+/, '');
        paragraphs.push(createParagraph(bulletText, 'bullet'));
      } else if (line.startsWith('**') && line.endsWith('**')) {
        paragraphs.push(createParagraph(line, 'h3'));
      } else if (line === '---') {
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
            spacing: { after: 200 },
          })
        );
      } else {
        paragraphs.push(createParagraph(line, 'normal'));
      }
    }

    // Firma
    paragraphs.push(new PageBreak());
    paragraphs.push(
      new Paragraph({
        text: '____________________________',
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 100 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: 'José Ángel García Márquez',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          bold: true,
          size: 22,
          name: 'Calibri',
        }),
        spacing: { after: 50 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: 'DNI: 09055639X | Responsable Único de Oficaz',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          size: 20,
          color: '666666',
          name: 'Calibri',
        }),
      })
    );

    // Crear documento
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

    // Guardar
    return Packer.toBuffer(doc).then((buffer) => {
      fs.writeFileSync(docxPath, buffer);
      console.log(`✅ ${path.basename(docxPath)}`);
      return true;
    }).catch((err) => {
      console.error(`❌ Error escribiendo ${path.basename(docxPath)}: ${err.message}`);
      return false;
    });
  } catch (error) {
    console.error(`❌ Error procesando ${path.basename(mdPath)}: ${error.message}`);
    return Promise.resolve(false);
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

console.log('\n📄 Regenerando documentos Word...\n');

// Limpiar directorio anterior
if (fs.existsSync(OUTPUT_DIR)) {
  fs.readdirSync(OUTPUT_DIR).forEach((file) => {
    if (file.endsWith('.docx')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  });
}

// Procesar archivos
const promises = mdFiles.map((file) => {
  const mdPath = path.join(DOCS_DIR, file);
  const docxPath = path.join(OUTPUT_DIR, file.replace('.md', '.docx'));
  
  if (fs.existsSync(mdPath)) {
    return convertMarkdownToWord(mdPath, docxPath);
  }
  return Promise.resolve(false);
});

Promise.all(promises).then(() => {
  console.log('\n✅ Documentos regenerados exitosamente en: docs/legal/word/\n');
});
