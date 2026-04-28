const fs = require('fs');

const files = [
  'client/src/pages/admin-documents.tsx',
  'server/ai-assistant.ts',
  'client/src/pages/admin-schedules.tsx',
  'server/routes.ts',
];

const badRegex = /[\u00c2\u00c3\u00e2\u00ef\u00f0\ufffd]/g;

function countBad(text) {
  const m = text.match(badRegex);
  return m ? m.length : 0;
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, 'utf8');
  const before = countBad(original);

  // Attempt latin1 -> utf8 recovery only if it improves suspicious-char count.
  const recovered = Buffer.from(original, 'latin1').toString('utf8');
  const after = countBad(recovered);

  if (after < before) {
    fs.writeFileSync(file, recovered, 'utf8');
    console.log(`[fixed] ${file}: ${before} -> ${after}`);
  } else {
    console.log(`[skip]  ${file}: ${before} -> ${after}`);
  }
}
