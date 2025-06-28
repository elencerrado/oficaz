import { describe, it, expect } from 'vitest';
import { analyzeFileName } from '@/utils/documentUtils';

// Test específico para el problema reportado por el usuario
describe('Document Detection Issue - nomina junio 2025 - juan jose ramirez', () => {
  
  // Datos reales de la base de datos actual
  const realEmployees = [
    {
      id: 1,
      fullName: 'Andrés González Rubio',
      email: 'admin@test.com',
      role: 'admin'
    },
    {
      id: 5,
      fullName: 'Juan José Ramirez Martín',  // Este es el empleado del problema
      email: 'j.ramirez@test.com',
      role: 'employee'
    },
    {
      id: 3,
      fullName: 'Marta Pérez García',
      email: 'marta.perez@test.com',
      role: 'employee'
    }
  ];

  it('should detect Juan José Ramirez from nomina file name', () => {
    const fileName = 'nomina junio 2025 - juan jose ramirez';
    const result = analyzeFileName(fileName, realEmployees);
    
    console.log('Test result:', {
      fileName,
      employee: result.employee?.fullName,
      documentType: result.documentType,
      confidence: result.confidence
    });
    
    // Este test debería pasar pero actualmente falla
    expect(result.employee?.fullName).toBe('Juan José Ramirez Martín');
    expect(result.documentType).toBe('nomina');
    expect(result.confidence).toBe('high');
  });

  it('should detect with various name combinations', () => {
    const testCases = [
      'nomina juan jose ramirez marzo.pdf',
      'nomina_junio_2025_juan_jose_ramirez.pdf',
      'nómina - Juan José Ramírez - abril 2025.pdf',
      'NOMINA_JUAN_JOSE_RAMIREZ_MAYO.PDF',
      'nomina junio 2025 - juan jose ramirez martin.pdf'
    ];

    testCases.forEach(fileName => {
      const result = analyzeFileName(fileName, realEmployees);
      console.log(`Testing: ${fileName}`, {
        employee: result.employee?.fullName,
        confidence: result.confidence
      });
      
      expect(result.employee?.fullName).toBe('Juan José Ramirez Martín');
      expect(result.documentType).toBe('nomina');
    });
  });

  it('should show debug info for the failing case', () => {
    const fileName = 'nomina junio 2025 - juan jose ramirez';
    const employee = realEmployees.find(emp => emp.fullName === 'Juan José Ramirez Martín');
    
    console.log('DEBUG INFO:');
    console.log('File name:', fileName);
    console.log('Employee name:', employee?.fullName);
    
    // Simular la lógica actual
    const normalizedFileName = fileName.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    const empName = employee?.fullName.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    const nameWords = empName?.split(' ') || [];
    const matchedWords = nameWords.filter(word => 
      word.length > 2 && normalizedFileName.includes(word)
    );
    
    console.log('Normalized file name:', normalizedFileName);
    console.log('Normalized employee name:', empName);
    console.log('Name words:', nameWords);
    console.log('Matched words:', matchedWords);
    console.log('Matched words count:', matchedWords.length);
    
    // Actualmente requiere >= 2 matches, pero solo encuentra ["juan", "jose", "ramirez"] = 3 matches
    // Esto debería funcionar, veamos qué está pasando
  });
});