// ⚠️ PROTECTED CODE - DO NOT MODIFY ⚠️
// Esta función es crítica para la clasificación automática de documentos
// Cualquier cambio puede romper funcionalidades existentes

interface Employee {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

interface DocumentType {
  id: string;
  name: string;
  keywords: string[];
}

export const documentTypes = [
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

/**
 * Analiza un nombre de archivo para determinar empleado y tipo de documento
 * @param fileName - Nombre del archivo a analizar
 * @param employees - Lista de empleados para matchear
 * @returns Objeto con empleado, tipo de documento y nivel de confianza
 */
export const analyzeFileName = (fileName: string, employees: Employee[] = []) => {
  // ⚠️ PROTECTED - DO NOT MODIFY
  // This function is critical for document detection
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedFileName = normalizeText(fileName);
  console.log('🔍 analyzeFileName DEBUG:', {
    originalFileName: fileName,
    normalizedFileName,
    documentTypesLength: documentTypes.length
  });
  
  // Document type detection using the predefined document types
  let documentType = 'Documento';
  for (const docType of documentTypes) {
    console.log('🔍 Checking docType:', docType.name, 'keywords:', docType.keywords);
    const hasKeyword = docType.keywords.some(keyword => {
      const includes = normalizedFileName.includes(keyword);
      console.log(`  - keyword "${keyword}": ${includes}`);
      return includes;
    });
    
    if (hasKeyword) {
      documentType = docType.name;
      console.log('✅ MATCH found:', documentType);
      break;
    }
  }
  
  console.log('🎯 Final documentType:', documentType);

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
    employee: bestMatch,
    documentType: documentType,
    confidence: highestConfidence
  };
};
// ⚠️ END PROTECTED CODE ⚠️