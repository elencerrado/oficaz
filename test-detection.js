// Test temporal para verificar la detección de empleados
const analyzeFileName = (fileName, employees) => {
  console.log('=== ANÁLISIS DIRECTO ===');
  console.log('Archivo:', fileName);
  console.log('Empleados:', employees.map(emp => emp.fullName));

  // ⚠️ PROTECTED - DO NOT MODIFY
  // This function is critical for document detection
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
  console.log('Nombre normalizado:', normalizedFileName);
  
  const documentTypes = [
    { keywords: ['nomina', 'salario', 'payroll', 'salary'], type: 'Nómina' },
    { keywords: ['contrato', 'contract'], type: 'Contrato' },
    { keywords: ['cv', 'curriculum', 'resume'], type: 'CV' },
    { keywords: ['justificante', 'certificate', 'certificado'], type: 'Certificado' },
    { keywords: ['factura', 'invoice'], type: 'Factura' },
    { keywords: ['recibo', 'receipt'], type: 'Recibo' }
  ];

  let documentType = 'Documento';
  for (const docType of documentTypes) {
    if (docType.keywords.some(keyword => normalizedFileName.includes(keyword))) {
      documentType = docType.type;
      break;
    }
  }

  console.log('Tipo documento detectado:', documentType);

  // Find best matching employee
  let bestMatch = null;
  let highestConfidence = 0;

  for (const employee of employees) {
    const normalizedEmployeeName = normalizeText(employee.fullName);
    const employeeWords = normalizedEmployeeName.split(/\s+/).filter(word => word.length > 2);
    
    console.log(`\nAnalizando empleado: ${employee.fullName}`);
    console.log('Palabras empleado:', employeeWords);
    
    let matchingWords = 0;
    for (const word of employeeWords) {
      if (normalizedFileName.includes(word)) {
        matchingWords++;
        console.log(`  ✓ Palabra encontrada: ${word}`);
      } else {
        console.log(`  ✗ Palabra NO encontrada: ${word}`);
      }
    }

    if (matchingWords >= 2) {
      const confidence = matchingWords / employeeWords.length;
      console.log(`Confianza calculada: ${matchingWords}/${employeeWords.length} = ${confidence}`);
      
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = employee;
        console.log('★ NUEVO MEJOR MATCH');
      }
    }
  }

  console.log('\n=== RESULTADO FINAL ===');
  console.log('Mejor match:', bestMatch?.fullName || 'NINGUNO');
  console.log('Confianza:', highestConfidence);
  
  return {
    employee: bestMatch,
    documentType,
    confidence: highestConfidence
  };
};

// Simular empleados reales
const employees = [
  { id: 1, fullName: "Andrés González Rubio" },
  { id: 5, fullName: "Juan José Ramirez Martín" }
];

// Test con el archivo problemático
const fileName = "nomina junio 2025 - juan jose ramirez";
const result = analyzeFileName(fileName, employees);

console.log('\n🎯 RESULTADO FINAL:');
console.log('Empleado detectado:', result.employee?.fullName || 'NINGUNO');
console.log('Tipo documento:', result.documentType);
console.log('Confianza:', result.confidence);