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
    keywords: ['justificante', 'certificado', 'comprobante', 'vacaciones', 'vacation', 'holiday', 'permiso', 'baja', 'medico', 'bajamedica', 'asuntospersonales', 'asuntoslaborales', 'paternidad', 'maternidad', 'paternidadmaternidad', 'formacion', 'deberinexcusable', 'incapacidadtemporal', 'ausencia']
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
  
  // Document type detection using the predefined document types
  let documentType = 'Documento';
  for (const docType of documentTypes) {
    if (docType.keywords.some(keyword => normalizedFileName.includes(keyword))) {
      documentType = docType.name;
      break;
    }
  }

  // Find best matching employee with improved logic
  let bestMatch = null;
  let highestScore = 0;

  for (const employee of employees) {
    const normalizedEmployeeName = normalizeText(employee.fullName);
    const employeeWords = normalizedEmployeeName.split(/\s+/).filter(word => word.length > 2);
    
    if (employeeWords.length === 0) continue;

    // Calculate match score with word length weighting
    let matchScore = 0;
    let matchedWords = 0;
    let maxWordLength = 0; // Track longest matched word (important for last names)
    
    for (const word of employeeWords) {
      if (normalizedFileName.includes(word)) {
        matchedWords++;
        // Give more weight to longer words (last names are typically longer)
        const wordWeight = Math.pow(word.length, 1.2);
        matchScore += wordWeight;
        maxWordLength = Math.max(maxWordLength, word.length);
      }
    }

    // Only consider matches with at least 2 words or high confidence with long words
    if (matchedWords >= 2 || (matchedWords === 1 && maxWordLength >= 8)) {
      // Normalize score: divide by number of words to avoid favoring longer names
      const confidenceRatio = matchedWords / employeeWords.length;
      
      // Combined score: word match weight + confidence + bonus for longer last names
      const finalScore = matchScore * confidenceRatio + maxWordLength * 0.5;
      
      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestMatch = employee;
      }
    }
  }

  // Fall back to word matching for cases where no clear match
  if (!bestMatch && employees.length > 0) {
    let bestPartialMatch = null;
    let bestPartialScore = 0;

    for (const employee of employees) {
      const normalizedEmployeeName = normalizeText(employee.fullName);
      const employeeWords = normalizedEmployeeName.split(/\s+/).filter(word => word.length > 2);
      
      // Last name is typically the last word - prioritize matching it
      if (employeeWords.length > 0) {
        const lastName = employeeWords[employeeWords.length - 1];
        if (lastName.length > 4 && normalizedFileName.includes(lastName)) {
          const score = lastName.length * 10; // High priority for explicit last name match
          if (score > bestPartialScore) {
            bestPartialScore = score;
            bestPartialMatch = employee;
          }
        }
      }
    }
    
    if (bestPartialMatch) {
      bestMatch = bestPartialMatch;
      highestScore = bestPartialScore;
    }
  }

  return {
    employee: bestMatch,
    documentType: documentType,
    confidence: highestScore > 0 ? Math.min(highestScore / 100, 1) : 0
  };
};
// ⚠️ END PROTECTED CODE ⚠️