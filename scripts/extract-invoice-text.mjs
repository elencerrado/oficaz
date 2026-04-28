import fs from 'fs';
import pdf from 'pdf-parse';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node extract-invoice-text.mjs <pdfPath>');
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const result = await pdf(buffer);
console.log(result.text);
