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
    id: 'dni', 
    name: 'DNI',
    keywords: ['dni', 'documento', 'identidad', 'cedula', 'id']
  },
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
  }
];

/**
 * Analiza un nombre de archivo para determinar empleado y tipo de documento
 * @param fileName - Nombre del archivo a analizar
 * @param employees - Lista de empleados para matchear
 * @returns Objeto con empleado, tipo de documento y nivel de confianza
 */
export const analyzeFileName = (fileName: string, employees: Employee[] = []) => {
  const normalizedName = fileName.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents
  
  // ⚠️ PROTECTED: Employee matching logic - DO NOT CHANGE
  const matchedEmployee = employees.find((emp: Employee) => {
    const empName = emp.fullName.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    // Split employee name into words
    const nameWords = empName.split(' ');
    
    // Check if at least 2 words from employee name appear in filename
    const matchedWords = nameWords.filter(word => 
      word.length > 2 && normalizedName.includes(word)
    );
    
    return matchedWords.length >= 2;
  });
  
  // ⚠️ PROTECTED: Document type detection - CRITICAL FUNCTIONALITY
  // This logic MUST detect: nomina/nómina, contrato, dni, justificante
  const documentType = documentTypes.find(type => {
    const typeKeywords = type.keywords || [];
    return typeKeywords.some(keyword => 
      normalizedName.includes(keyword.toLowerCase())
    );
  });
  
  // ⚠️ PROTECTED: Return structure - DO NOT MODIFY
  return {
    employee: matchedEmployee,
    documentType: documentType?.id || 'otros',
    confidence: matchedEmployee ? (documentType ? 'high' : 'medium') : 'low'
  };
};
// ⚠️ END PROTECTED CODE ⚠️