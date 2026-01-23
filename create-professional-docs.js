#!/usr/bin/env node

/**
 * Script avanzado para crear documentos Word profesionales desde Markdown
 * Con estilos mejorados, colores corporativos y formato legal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, BorderStyle, convertInchesToTwip, PageBreak, AlignmentType } from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, 'docs', 'legal');
const OUTPUT_DIR = path.join(__dirname, 'docs', 'legal', 'word');

// Crear directorio si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Función para limpiar markdown
function cleanMarkdown(text) {
  return text
    .replace(/\*\*([^\*]+)\*\*/g, '$1') // bold
    .replace(/\*([^\*]+)\*/g, '$1') // italic
    .replace(/`([^`]+)`/g, '$1') // code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
    .replace(/^#+\s+/, ''); // headings
}

// Estilos corporativos
const COLORS = {
  primary: '000080', // Navy blue
  secondary: '4472C4', // Corporate blue
  accent: '70AD47', // Green
  text: '333333', // Dark gray
  lightGray: 'F2F2F2',
};

// Crear celda de tabla
function createTableCell(text, options = {}) {
  const { bold = false, align = AlignmentType.LEFT, background = null, width = 2000 } = options;
  
  return new TableCell({
    text: cleanMarkdown(text),
    rowSpan: 1,
    columnSpan: 1,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
    },
    shading: background ? { fill: background, type: 'clear' } : undefined,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    verticalAlign: 'center',
    children: [
      new Paragraph({
        text: cleanMarkdown(text),
        alignment: align,
        run: new TextRun({
          bold: bold,
          size: 20,
          color: bold ? 'FFFFFF' : COLORS.text,
        }),
      }),
    ],
  });
}

// Convertir markdown a documento Word profesional
function convertToWord(filePath, outputPath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');
    const lines = content.split('\n');

    const children = [];

    // Portada
    children.push(
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

    children.push(
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

    // Título del documento
    const docTitle = fileName
      .replace(/_/g, ' ')
      .replace(/POLITICA_PRIVACIDAD/, 'POLÍTICA DE PRIVACIDAD')
      .replace(/CONTRATO_ENCARGO_TRATAMIENTO/, 'CONTRATO DE ENCARGO DE TRATAMIENTO')
      .replace(/REGISTRO_ACTIVIDADES_TRATAMIENTO/, 'REGISTRO DE ACTIVIDADES DE TRATAMIENTO')
      .replace(/PROCEDIMIENTO_BRECHAS_SEGURIDAD/, 'PROCEDIMIENTO DE BRECHAS DE SEGURIDAD')
      .replace(/ANALISIS_RIESGOS/, 'ANÁLISIS DE RIESGOS')
      .replace(/MEDIDAS_SEGURIDAD/, 'MEDIDAS DE SEGURIDAD')
      .replace(/CLAUSULAS_INFORMATIVAS_TRABAJADORES/, 'CLÁUSULAS INFORMATIVAS PARA TRABAJADORES');

    children.push(
      new Paragraph({
        text: docTitle,
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          bold: true,
          size: 32,
          color: COLORS.primary,
          name: 'Calibri',
        }),
        spacing: { before: 400, after: 800 },
        border: {
          bottom: {
            color: COLORS.secondary,
            space: 1,
            style: BorderStyle.DOUBLE,
            size: 12,
          },
        },
      })
    );

    // Información del documento
    children.push(
      new Paragraph({
        text: `Versión: 1.0 | Fecha: 16 de enero de 2026 | Responsable: José Ángel García Márquez (DNI: 09055639X)`,
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          size: 18,
          color: '666666',
          italics: true,
          name: 'Calibri',
        }),
        spacing: { after: 600 },
      })
    );

    children.push(new PageBreak());

    // Tabla de contenidos
    children.push(
      new Paragraph({
        text: 'ÍNDICE',
        run: new TextRun({
          bold: true,
          size: 28,
          color: COLORS.primary,
          name: 'Calibri',
        }),
        spacing: { after: 400 },
        border: {
          bottom: {
            color: COLORS.secondary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );

    // Procesar contenido
    let currentSection = 1;
    let inPreformatted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Omitir primeras líneas y encabezados del markdown
      if (
        line.includes('---') ||
        line.includes('Oficaz') ||
        line.includes('Documentación') ||
        line.match(/^version|^fecha|^uso|^formato/i)
      ) {
        continue;
      }

      // Títulos nivel 1
      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: cleanMarkdown(line.replace('# ', '')),
            run: new TextRun({
              bold: true,
              size: 28,
              color: COLORS.primary,
              name: 'Calibri',
            }),
            spacing: { before: 400, after: 300 },
            border: {
              bottom: {
                color: COLORS.secondary,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          })
        );
        currentSection++;
      }
      // Títulos nivel 2
      else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: cleanMarkdown(line.replace('## ', '')),
            run: new TextRun({
              bold: true,
              size: 24,
              color: COLORS.secondary,
              name: 'Calibri',
            }),
            spacing: { before: 300, after: 200 },
          })
        );
      }
      // Títulos nivel 3
      else if (line.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: cleanMarkdown(line.replace('### ', '')),
            run: new TextRun({
              bold: true,
              size: 22,
              color: COLORS.accent,
              name: 'Calibri',
            }),
            spacing: { before: 200, after: 150 },
          })
        );
      }
      // Viñetas
      else if (line.match(/^\s*[-*✅]\s+/)) {
        const bulletText = line.replace(/^\s*[-*✅]\s+/, '');
        children.push(
          new Paragraph({
            text: cleanMarkdown(bulletText),
            bullet: { level: 0 },
            run: new TextRun({
              size: 22,
              name: 'Calibri',
            }),
            spacing: { after: 150 },
            indent: { left: 720, hanging: 360 },
          })
        );
      }
      // Párrafos normales
      else if (line.trim().length > 0 && !line.startsWith('|')) {
        children.push(
          new Paragraph({
            text: cleanMarkdown(line),
            run: new TextRun({
              size: 22,
              color: COLORS.text,
              name: 'Calibri',
            }),
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
          })
        );
      }
    }

    // Agregar pie de página
    children.push(new PageBreak());
    children.push(
      new Paragraph({
        text: '____________________________',
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 100 },
      })
    );

    children.push(
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

    children.push(
      new Paragraph({
        text: 'DNI: 09055639X | Responsable Único de Oficaz',
        alignment: AlignmentType.CENTER,
        run: new TextRun({
          size: 20,
          color: '666666',
          name: 'Calibri',
        }),
        spacing: { after: 400 },
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
          children: children,
        },
      ],
    });

    // Guardar
    Packer.toBuffer(doc).then((buffer) => {
      fs.writeFileSync(outputPath, buffer);
      const docName = path.basename(outputPath);
      console.log(`  ✅ ${docName}`);
    });
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Archivos a procesar
const mdFiles = [
  'POLITICA_PRIVACIDAD.md',
  'CONTRATO_ENCARGO_TRATAMIENTO.md',
  'REGISTRO_ACTIVIDADES_TRATAMIENTO.md',
  'PROCEDIMIENTO_BRECHAS_SEGURIDAD.md',
  'ANALISIS_RIESGOS.md',
  'MEDIDAS_SEGURIDAD.md',
  'CLAUSULAS_INFORMATIVAS_TRABAJADORES.md',
];

console.log('\n📄 Creando documentos Word profesionales...\n');

mdFiles.forEach((file) => {
  const mdPath = path.join(DOCS_DIR, file);
  const wordPath = path.join(OUTPUT_DIR, file.replace('.md', '.docx'));

  if (fs.existsSync(mdPath)) {
    convertToWord(mdPath, wordPath);
  }
});

console.log('\n✅ Documentos generados en: docs/legal/word/\n');
