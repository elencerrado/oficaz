// Test manual de la función analyzeFileName

const documentTypes = [
  { 
    id: 'nomina', 
    name: 'Nómina',
    keywords: ['nomina', 'nómina', 'payroll', 'salary', 'salario', 'sueldo']
  },
  { 
    id: 'contrato', 
    name: 'Contrato',
    keywords: ['contrato', 'contract', 'agreement', 'acuerdo', 'convenio']
  },
  { 
    id: 'justificante', 
    name: 'Justificante',
    keywords: ['justificante', 'certificado', 'comprobante', 'vacaciones', 'vacation', 'holiday', 'permiso', 'baja', 'medico']
  },
  { 
    id: 'otros', 
    name: 'Otros',
    keywords: ['irpf', 'hacienda', 'impuesto', 'declaracion', 'renta', 'tributacion', 'fiscal', 'formulario', 'modelo', 'aeat']
  },
  { 
    id: 'dni', 
    name: 'DNI',
    keywords: ['dni', 'documento identidad', 'cedula', 'id card']
  }
];

function analyzeFileName(fileName, employees = []) {
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedFileName = normalizeText(fileName);
  
  // Document type detection using the predefined document types
  let documentType = 'Documento';
  for (const docType of documentTypes) {
    if (docType.keywords.some(keyword => normalizedFileName.includes(keyword))) {
      documentType = docType.name;
      break;
    }
  }

  // Find best matching employee
  let bestMatch = null;
  let highestConfidence = 0;

  for (const employee of employees) {
    const normalizedEmployeeName = normalizeText(employee.fullName);
    const employeeWords = normalizedEmployeeName.split(/\s+/).filter(word => word.length > 2);
    
    let matchingWords = 0;
    for (const word of employeeWords) {
      if (normalizedFileName.includes(word)) {
        matchingWords++;
      }
    }

    if (matchingWords >= 2) {
      const confidence = matchingWords / employeeWords.length;
      
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = employee;
      }
    }
  }

  return {
    documentType,
    employee: bestMatch,
    confidence: Math.round(highestConfidence * 100) / 100
  };
}

// Test
const fileName = 'nomina junio 2025 - juan jose ramirez.pdf';
const employees = [
  { id: 5, fullName: 'Juan José Ramirez Martín', email: 'juan@test.com', role: 'employee' }
];

console.log('Testing analyzeFileName function...');
console.log('File:', fileName);
console.log('Available document types:', documentTypes.map(dt => dt.name));

const result = analyzeFileName(fileName, employees);
console.log('Result:', result);

console.log('\nTesting normalization:');
const normalizedFileName = fileName
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
console.log('Normalized:', normalizedFileName);
console.log('Contains "nomina":', normalizedFileName.includes('nomina'));