import { describe, it, expect } from 'vitest';
import { analyzeFileName, documentTypes } from '@/utils/documentUtils';

// Datos de prueba simulando empleados reales
const mockEmployees = [
  { id: 1, fullName: 'Juan José García López', email: 'juan@test.com', role: 'employee' },
  { id: 2, fullName: 'María Carmen Sánchez Ruiz', email: 'maria@test.com', role: 'employee' },
  { id: 3, fullName: 'José Luis Fernández Martín', email: 'jose@test.com', role: 'manager' },
  { id: 4, fullName: 'Ana Belén Rodríguez González', email: 'ana@test.com', role: 'employee' }
];

describe('analyzeFileName - Función crítica de clasificación de documentos', () => {
  describe('Detección de tipo de documento', () => {
    it('detecta correctamente documentos de nómina', () => {
      const result = analyzeFileName('nomina_enero_2025.pdf', mockEmployees);
      expect(result.documentType).toBe('Nómina');
    });

    it('detecta nómina con acento', () => {
      const result = analyzeFileName('nómina_febrero_2025.pdf', mockEmployees);
      expect(result.documentType).toBe('Nómina');
    });

    it('detecta documentos de contrato', () => {
      const result = analyzeFileName('contrato_trabajo_definitivo.pdf', mockEmployees);
      expect(result.documentType).toBe('Contrato');
    });

    it('detecta documentos de DNI', () => {
      const result = analyzeFileName('dni_empleado_fotocopia.pdf', mockEmployees);
      expect(result.documentType).toBe('DNI');
    });

    it('detecta justificantes médicos', () => {
      const result = analyzeFileName('justificante_medico_baja.pdf', mockEmployees);
      expect(result.documentType).toBe('Justificante');
    });

    it('clasifica como otros los documentos fiscales', () => {
      const result = analyzeFileName('modelo_irpf_2024.pdf', mockEmployees);
      expect(result.documentType).toBe('Otros');
    });

    it('clasifica como otros los documentos sin keywords', () => {
      const result = analyzeFileName('archivo_random.pdf', mockEmployees);
      expect(result.documentType).toBe('Documento');
    });
  });

  describe('Detección de empleado por nombre', () => {
    it('detecta empleado con nombre completo', () => {
      const result = analyzeFileName('nomina_juan_jose_garcia_enero.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('Juan José García López');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detecta empleado con nombres parciales', () => {
      const result = analyzeFileName('contrato_maria_carmen.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('María Carmen Sánchez Ruiz');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('maneja acentos correctamente', () => {
      const result = analyzeFileName('documento_josé_luis.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('José Luis Fernández Martín');
    });

    it('requiere al menos 2 palabras del nombre para match', () => {
      const result = analyzeFileName('documento_juan.pdf', mockEmployees);
      expect(result.employee).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('ignora palabras cortas (menor a 3 caracteres)', () => {
      const result = analyzeFileName('nomina_ana_belen.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('Ana Belén Rodríguez González');
    });
  });

  describe('Niveles de confianza', () => {
    it('asigna confianza alta cuando detecta empleado Y tipo', () => {
      const result = analyzeFileName('nomina_juan_jose_garcia.pdf', mockEmployees);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.employee).toBeDefined();
      expect(result.documentType).toBe('Nómina');
    });

    it('asigna confianza media cuando detecta empleado pero NO tipo', () => {
      const result = analyzeFileName('archivo_maria_carmen.pdf', mockEmployees);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.employee).toBeDefined();
      expect(result.documentType).toBe('Documento');
    });

    it('asigna confianza baja cuando NO detecta empleado', () => {
      const result = analyzeFileName('nomina_empleado_externo.pdf', mockEmployees);
      expect(result.confidence).toBe(0);
      expect(result.employee).toBeNull();
      expect(result.documentType).toBe('Nómina');
    });
  });

  describe('Casos reales de nombres de archivo', () => {
    it('maneja archivos escaneados típicos', () => {
      const result = analyzeFileName('NOMINA_JUAN_JOSE_GARCIA_ESCANEADO.PDF', mockEmployees);
      expect(result.employee?.fullName).toBe('Juan José García López');
      expect(result.documentType).toBe('Nómina');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('maneja archivos con fechas', () => {
      const result = analyzeFileName('contrato_maria_carmen_sanchez_01_01_2025.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('María Carmen Sánchez Ruiz');
      expect(result.documentType).toBe('Contrato');
    });

    it('maneja archivos con underscores y espacios', () => {
      const result = analyzeFileName('DNI jose luis fernandez copia.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('José Luis Fernández Martín');
      expect(result.documentType).toBe('DNI');
    });
  });

  describe('Robustez y casos edge', () => {
    it('funciona sin lista de empleados', () => {
      const result = analyzeFileName('nomina_enero.pdf', []);
      expect(result.employee).toBeNull();
      expect(result.documentType).toBe('Nómina');
      expect(result.confidence).toBe(0);
    });

    it('maneja strings vacíos', () => {
      const result = analyzeFileName('', mockEmployees);
      expect(result.employee).toBeNull();
      expect(result.documentType).toBe('Documento');
      expect(result.confidence).toBe(0);
    });

    it('maneja caracteres especiales', () => {
      const result = analyzeFileName('nómina-juan@josé#garcía$.pdf', mockEmployees);
      expect(result.employee?.fullName).toBe('Juan José García López');
      expect(result.documentType).toBe('Nómina');
    });
  });

  describe('Validación de tipos de documento', () => {
    it('verifica que todos los tipos están definidos', () => {
      expect(documentTypes).toHaveLength(5);
      expect(documentTypes.map(t => t.id)).toEqual(['nomina', 'contrato', 'justificante', 'otros', 'dni']);
    });

    it('verifica que todos los tipos tienen keywords', () => {
      documentTypes.forEach(type => {
        expect(type.keywords).toBeDefined();
        expect(Array.isArray(type.keywords)).toBe(true);
        expect(type.keywords.length).toBeGreaterThan(0);
      });
    });
  });
});