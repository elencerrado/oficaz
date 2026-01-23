# ANÁLISIS DE RIESGOS - EVALUACIÓN DE IMPACTO (EIPD)
## Privacy Impact Assessment - Oficaz

**Fecha:** 16 de enero de 2026  
**Versión:** 1.0  
**Responsable:** José Ángel García Márquez (DNI: 09055639X)  
**Próxima revisión:** 16 de julio de 2026

---

## 1. INTRODUCCIÓN

### 1.1. Objeto

Este documento analiza los riesgos para los derechos y libertades de las personas físicas derivados de los tratamientos de datos personales realizados por **Oficaz**.

### 1.2. Marco normativo

- **Artículo 35 RGPD:** Evaluación de Impacto relativa a la Protección de Datos (EIPD)
- **Artículo 36 RGPD:** Consulta previa a la autoridad de control

### 1.3. ¿Cuándo es obligatoria una EIPD?

Según Art. 35.3 RGPD, es obligatoria cuando el tratamiento:

a) **Evaluación sistemática y exhaustiva** de aspectos personales basada en tratamiento automatizado (perfilado) y sobre cuya base se tomen decisiones que produzcan efectos jurídicos o afecten significativamente

b) **Tratamiento a gran escala de categorías especiales** de datos (Art. 9) o de datos relativos a condenas e infracciones penales (Art. 10)

c) **Observación sistemática a gran escala** de una zona de acceso público

**Además, según lista de AEPD (2020):**
- Tratamientos con **geolocalización** y **perfilado**
- Tratamientos de datos de **empleados** a gran escala con monitorización de comportamiento

### 1.4. ¿Oficaz debe hacer EIPD?

**Análisis:**

| Criterio | ¿Aplica a Oficaz? | Justificación |
|----------|-------------------|---------------|
| Perfilado con decisiones automatizadas | ❌ NO | No se toman decisiones automatizadas que afecten jurídicamente a los empleados |
| Categorías especiales a gran escala | ⚠️ PARCIAL | Geolocalización (con consentimiento) + bajas médicas (solo fechas, NO diagnóstico) |
| Observación sistemática zona pública | ❌ NO | Fichajes no son en zona pública |
| Geolocalización + perfilado | ⚠️ PARCIAL | Geolocalización SÍ, pero NO hay perfilado |
| Monitorización de empleados | ✅ SÍ | Control horario sistemático |

**Conclusión:**

Aunque Oficaz NO está obligada legalmente a realizar una EIPD completa (Art. 35.3 RGPD), es **altamente recomendable** realizarla como **buena práctica** dada la monitorización sistemática de empleados y el uso de geolocalización.

**Este documento constituye una EIPD voluntaria.**

---

## 2. DESCRIPCIÓN DE LOS TRATAMIENTOS DE RIESGO

### 2.1. Tratamiento 1: Control horario con geolocalización

**Responsable:** Empresa cliente (Oficaz como encargado)

**Finalidad:**
- Cumplimiento RD-ley 8/2019 (control horario obligatorio)
- Verificación de ubicación en fichajes (opcional)

**Datos tratados:**
- Fecha/hora de fichaje
- **Geolocalización GPS** (latitud, longitud, precisión)
- Dispositivo usado
- IP
- Auditoría de modificaciones

**Base jurídica:**
- Control horario: Obligación legal (RD-ley 8/2019)
- Geolocalización: **Consentimiento explícito del empleado**

**Número de interesados:** Variable por cliente (estimado: 1.000+ empleados en plataforma)

**Duración:** 4 años desde baja del empleado

**Características de riesgo:**
- ✅ Monitorización sistemática de empleados
- ✅ Uso de geolocalización (dato sensible)
- ✅ Gran escala (potencialmente)
- ⚠️ Perfilado de movimientos (bajo: solo se registra, no se analiza patrón de movilidad)

---

### 2.2. Tratamiento 2: Gestión documental (nóminas, contratos)

**Responsable:** Empresa cliente (Oficaz como encargado)

**Finalidad:**
- Distribución de nóminas
- Firma de contratos
- Archivo de documentos laborales

**Datos tratados:**
- Documentos PDF (nóminas con datos salariales)
- Contratos (condiciones laborales)
- Firma digital
- Fecha de vista/firma

**Base jurídica:**
- Ejecución del contrato laboral
- Obligación legal (conservación de nóminas)

**Número de interesados:** 1.000+ empleados

**Duración:** 4 años

**Características de riesgo:**
- ⚠️ Datos económicos (salarios)
- ⚠️ Riesgo de acceso no autorizado (impacto alto)

---

### 2.3. Tratamiento 3: Bajas médicas (solo fechas)

**Responsable:** Empresa cliente (Oficaz como encargado)

**Finalidad:**
- Registro de ausencias por incapacidad temporal

**Datos tratados:**
- Tipo de ausencia: "Baja médica" / "Incapacidad temporal"
- Fecha de inicio y fin
- **NO se almacena diagnóstico médico ni partes de baja**

**Base jurídica:**
- Ejecución del contrato + obligación legal

**Número de interesados:** Variable

**Características de riesgo:**
- ⚠️ Datos relacionados con salud (categoría especial Art. 9)
- ✅ Minimización: NO se guardan datos sensibles (solo fechas)

---

## 3. EVALUACIÓN DE LA NECESIDAD Y PROPORCIONALIDAD

### 3.1. ¿Es necesario el tratamiento?

| Tratamiento | ¿Necesario? | Justificación |
|-------------|-------------|---------------|
| Control horario | ✅ SÍ | Obligación legal (RD-ley 8/2019) |
| Geolocalización | ⚠️ OPCIONAL | Útil para empresas con trabajadores móviles, pero NO obligatorio |
| Nóminas | ✅ SÍ | Obligación laboral (distribución segura) |
| Bajas médicas (fechas) | ✅ SÍ | Gestión de ausencias |

### 3.2. ¿Es proporcional?

**Principio de minimización:**

| Dato | ¿Minimizado? | Justificación |
|------|-------------|---------------|
| Geolocalización | ✅ SÍ | Solo si empleado consiente, se puede fichar sin ubicación |
| Nóminas | ✅ SÍ | Oficaz NO procesa cifras salariales, solo almacena PDFs |
| Bajas médicas | ✅ SÍ | Solo fechas, NO diagnósticos |
| Auditoría de fichajes | ✅ SÍ | Obligación legal RD-ley 8/2019 (trazabilidad) |

**Alternativas menos intrusivas evaluadas:**

- **Fichaje sin geolocalización:** ✅ Implementado (opción por defecto)
- **Nóminas en papel:** ❌ Menos seguro, no trazable
- **Control horario en Excel:** ❌ No cumple RD-ley 8/2019 (requiere auditoría)

**Conclusión:** Los tratamientos son proporcionales y cumplen el principio de minimización.

---

## 4. EVALUACIÓN DE RIESGOS

### 4.1. Metodología

**Nivel de riesgo = Probabilidad × Impacto**

**Probabilidad:**
- Baja: < 10%
- Media: 10-50%
- Alta: > 50%

**Impacto en derechos y libertades:**
- Bajo: Molestia menor
- Medio: Afectación significativa
- Alto: Consecuencias graves (discriminación, fraude, daño reputacional)

**Matriz de riesgo:**

| Probabilidad | Impacto Bajo | Impacto Medio | Impacto Alto |
|--------------|--------------|---------------|--------------|
| Baja | **Riesgo Bajo** | Riesgo Medio | Riesgo Alto |
| Media | Riesgo Medio | **Riesgo Medio** | Riesgo Alto |
| Alta | Riesgo Alto | Riesgo Alto | **Riesgo Muy Alto** |

---

### 4.2. Riesgo 1: Acceso no autorizado a datos de empleados

**Escenario:**
- Un atacante compromete la base de datos y accede a datos de empleados (nombres, DNI, emails, fichajes, geolocalización)

**Origen:**
- Vulnerabilidad de seguridad explotada
- Credenciales de administrador robadas (phishing)
- Fallo de configuración (base de datos accesible públicamente)

**Impacto en interesados:**
- **ALTO:** Exposición de DNI, geolocalización, datos laborales
- Posible usurpación de identidad
- Violación de privacidad (tracking de ubicaciones)
- Daño reputacional si se publicase

**Probabilidad:**
- **MEDIA:** Ataques a plataformas SaaS son frecuentes, pero medidas de seguridad actuales reducen probabilidad

**Nivel de riesgo:** **MEDIO-ALTO**

**Medidas de mitigación actuales:**

- ✅ Cifrado HTTPS/TLS 1.3
- ✅ Contraseñas hasheadas bcrypt
- ✅ Autenticación JWT con tokens de corta duración
- ✅ Firewall WAF (Cloudflare)
- ✅ Backups cifrados
- ✅ Segregación multi-tenant (empresa X no puede ver datos de empresa Y)
- ✅ Auditoría de logs de acceso
- ✅ 2FA disponible (recomendado para admins)

**Medidas adicionales recomendadas:**

- 🔹 **2FA obligatorio** para administradores (actualmente opcional)
- 🔹 Pentesting anual externo
- 🔹 IDS/IPS (Intrusion Detection/Prevention System)
- 🔹 Cifrado adicional de geolocalización en base de datos (actualmente en texto plano)

**Riesgo residual:** **MEDIO** (tras implementar medidas adicionales: **BAJO**)

---

### 4.3. Riesgo 2: Uso indebido de geolocalización por parte del empleador

**Escenario:**
- Un empleador usa los datos de geolocalización para fines distintos del control horario (ej: tracking de movimientos fuera del horario laboral, control de rutas privadas)

**Origen:**
- Falta de limitación de finalidad por parte del empleador
- Geolocalización activada sin consentimiento claro

**Impacto en interesados:**
- **ALTO:** Violación grave de privacidad
- Posible discriminación (ej: conocer visitas a sindicato, médico, etc.)
- Vulneración de libertad de movimiento

**Probabilidad:**
- **BAJA:** El sistema solo captura ubicación en el momento del fichaje (no tracking continuo), y requiere consentimiento explícito

**Nivel de riesgo:** **MEDIO**

**Medidas de mitigación actuales:**

- ✅ **Consentimiento explícito** del empleado (banner al primer fichaje)
- ✅ Posibilidad de **denegar** (el fichaje funciona sin ubicación)
- ✅ Posibilidad de **revocar** consentimiento en cualquier momento
- ✅ Solo se captura ubicación **en el momento del fichaje** (NO tracking continuo)
- ✅ Cláusula informativa para empleados (Anexo III del Contrato de Encargo)

**Medidas adicionales recomendadas:**

- 🔹 **Formación obligatoria** para empleadores sobre uso legítimo de geolocalización
- 🔹 **Alertas automáticas** si se detecta acceso excesivo a datos de ubicación
- 🔹 **Auditoría trimestral** de accesos a geolocalización por empresa

**Riesgo residual:** **BAJO**

---

### 4.4. Riesgo 3: Modificación no autorizada de fichajes (sin auditoría)

**Escenario:**
- Un administrador modifica fichajes de empleados sin dejar rastro, perjudicando al empleado en su cálculo de horas

**Origen:**
- Falta de auditoría
- Acceso excesivo de administradores

**Impacto en interesados:**
- **ALTO:** Pérdida de derechos laborales (horas extras no pagadas, sanciones injustas)
- Falta de trazabilidad (incumplimiento RD-ley 8/2019)

**Probabilidad:**
- **MUY BAJA:** El sistema tiene auditoría completa de modificaciones

**Nivel de riesgo:** **BAJO**

**Medidas de mitigación actuales:**

- ✅ **Auditoría completa e inmutable** de toda modificación de fichajes (quién, cuándo, qué, por qué)
- ✅ Valores antiguos y nuevos guardados en JSON
- ✅ Registro conservado 4 años (obligación legal)
- ✅ Acceso a auditoría por Inspección de Trabajo

**Riesgo residual:** **MUY BAJO**

---

### 4.5. Riesgo 4: Fuga de nóminas por envío a destinatario equivocado

**Escenario:**
- Un administrador sube una nómina y la asigna al empleado equivocado, exponiendo datos salariales de un tercero

**Origen:**
- Error humano
- Interfaz confusa

**Impacto en interesados:**
- **MEDIO:** Exposición de datos económicos (salario)
- Posible discriminación o uso indebido

**Probabilidad:**
- **MEDIA:** Errores humanos son frecuentes

**Nivel de riesgo:** **MEDIO**

**Medidas de mitigación actuales:**

- ✅ URLs de descarga firmadas y de un solo uso
- ✅ Solo el empleado destinatario puede ver su nómina
- ✅ Auditoría de descargas (IP, fecha/hora)
- ✅ Notificación al empleado cuando se sube nuevo documento

**Medidas adicionales recomendadas:**

- 🔹 **Confirmación obligatoria** al subir documentos sensibles (checkbox "He verificado el destinatario")
- 🔹 **Vista previa** del nombre del empleado antes de subir
- 🔹 **Bloqueo de asignación masiva** (solo permitir de uno en uno para nóminas)

**Riesgo residual:** **BAJO** (tras implementar medidas adicionales)

---

### 4.6. Riesgo 5: Pérdida de datos por ransomware

**Escenario:**
- Ataque de ransomware cifra toda la base de datos, haciendo inaccesibles los datos de empleados

**Origen:**
- Ataque externo (phishing, vulnerabilidad)

**Impacto en interesados:**
- **MEDIO:** Pérdida temporal de acceso a nóminas, fichajes
- NO hay exposición de datos (solo cifrado)

**Probabilidad:**
- **BAJA:** Medidas de seguridad actuales reducen probabilidad

**Nivel de riesgo:** **BAJO-MEDIO**

**Medidas de mitigación actuales:**

- ✅ Backups automáticos diarios cifrados
- ✅ Backups almacenados separados de producción
- ✅ Pruebas de restauración trimestrales
- ✅ Firewall WAF (Cloudflare)
- ✅ Protección anti-DDoS

**Medidas adicionales recomendadas:**

- 🔹 **Backups offline** (air-gapped) mensuales
- 🔹 **Segmentación de red** (base de datos en red privada)
- 🔹 **Plan de recuperación ante desastres** documentado y probado anualmente

**Riesgo residual:** **BAJO**

---

### 4.7. Riesgo 6: Transferencias internacionales inseguras

**Escenario:**
- Datos de empleados se transfieren a USA sin garantías adecuadas

**Origen:**
- Subencargados en USA (Railway, Stripe, Cloudflare)
- Invalidación del Privacy Shield

**Impacto en interesados:**
- **MEDIO:** Posible acceso de autoridades USA sin garantías RGPD

**Probabilidad:**
- **BAJA:** Subencargados tienen cláusulas contractuales tipo

**Nivel de riesgo:** **BAJO-MEDIO**

**Medidas de mitigación actuales:**

- ✅ Cláusulas Contractuales Tipo UE con todos los subencargados USA
- ✅ Stripe: PCI-DSS, ISO 27001, SOC 2
- ✅ Railway: Opción de hosting exclusivo en UE (disponible)
- ✅ Cloudflare: Edge computing en UE

**Medidas adicionales recomendadas:**

- 🔹 **Activar hosting exclusivo en UE** (Railway) para máxima privacidad
- 🔹 **Evaluación anual** de subencargados (verificar que cláusulas siguen vigentes)

**Riesgo residual:** **MUY BAJO** (tras activar hosting UE)

---

## 5. RESUMEN DE RIESGOS

| Riesgo | Probabilidad | Impacto | Nivel | Riesgo Residual (tras medidas) |
|--------|--------------|---------|-------|-------------------------------|
| 1. Acceso no autorizado a BBDD | Media | Alto | **MEDIO-ALTO** | **BAJO** |
| 2. Uso indebido de geolocalización | Baja | Alto | **MEDIO** | **BAJO** |
| 3. Modificación de fichajes sin auditoría | Muy Baja | Alto | **BAJO** | **MUY BAJO** |
| 4. Fuga de nóminas por error | Media | Medio | **MEDIO** | **BAJO** |
| 5. Ransomware | Baja | Medio | **BAJO-MEDIO** | **BAJO** |
| 6. Transferencias internacionales | Baja | Medio | **BAJO-MEDIO** | **MUY BAJO** |

---

## 6. PLAN DE ACCIÓN

### 6.1. Medidas prioritarias (implementar en 1-3 meses)

| ID | Medida | Riesgo mitigado | Responsable | Plazo | Estado |
|----|--------|-----------------|-------------|-------|--------|
| M1 | **2FA obligatorio para administradores** | Riesgo 1 | CTO | 1 mes | ⏳ Pendiente |
| M2 | **Cifrado de geolocalización en BBDD** | Riesgo 1 | Dev Senior | 2 meses | ⏳ Pendiente |
| M3 | **Confirmación obligatoria al subir nóminas** | Riesgo 4 | Dev Frontend | 1 mes | ⏳ Pendiente |
| M4 | **Activar hosting exclusivo en UE (Railway)** | Riesgo 6 | DevOps | 1 mes | ⏳ Pendiente |

### 6.2. Medidas a medio plazo (3-6 meses)

| ID | Medida | Riesgo mitigado | Responsable | Plazo | Estado |
|----|--------|-----------------|-------------|-------|--------|
| M5 | **Pentesting anual externo** | Riesgo 1 | CTO | 3 meses | ⏳ Pendiente |
| M6 | **Auditoría trimestral de accesos a geolocalización** | Riesgo 2 | DPO | Trimestral | ⏳ Pendiente |
| M7 | **Formación obligatoria para empleadores** | Riesgo 2 | Marketing | 4 meses | ⏳ Pendiente |
| M8 | **Backups offline mensuales** | Riesgo 5 | DevOps | 6 meses | ⏳ Pendiente |

### 6.3. Medidas a largo plazo (6-12 meses)

| ID | Medida | Riesgo mitigado | Responsable | Plazo | Estado |
|----|--------|-----------------|-------------|-------|--------|
| M9 | **IDS/IPS (Intrusion Detection System)** | Riesgo 1 | CTO | 12 meses | ⏳ Pendiente |
| M10 | **Certificación ISO 27001** | Todos | CEO/CTO | 12 meses | ⏳ Pendiente |

---

## 7. CONSULTA A INTERESADOS

### 7.1. ¿Se ha consultado a empleados afectados?

- ⚠️ **NO:** Los empleados son empleados de empresas clientes, no de Oficaz directamente
- ✅ **SÍ (indirectamente):** A través de la cláusula informativa que las empresas cliente deben proporcionar (Anexo III del Contrato de Encargo)

### 7.2. ¿Se ha consultado al DPO (si procede)?

- ✅ **SÍ:** Este documento ha sido revisado por el responsable legal / DPO

---

## 8. CONCLUSIONES

### 8.1. ¿Los riesgos son aceptables?

**SÍ**, con las siguientes condiciones:

- ✅ Los riesgos actuales están **controlados** mediante medidas técnicas y organizativas
- ✅ Los riesgos residuales (tras implementar medidas adicionales) son **bajos o muy bajos**
- ✅ Los tratamientos son **necesarios y proporcionales**

### 8.2. ¿Es necesario consultar previamente a la AEPD (Art. 36 RGPD)?

**NO**, porque:

- ✅ Los riesgos NO son **altos** tras aplicar medidas de mitigación
- ✅ No hay tratamiento de categorías especiales a gran escala (geolocalización es opcional con consentimiento)
- ✅ No hay perfilado ni decisiones automatizadas

**Sin embargo**, es recomendable:

- 🔹 Solicitar asesoramiento informal a la AEPD si surgen dudas
- 🔹 Mantener este análisis de riesgos actualizado

---

## 9. APROBACIÓN Y SEGUIMIENTO

### 9.1. Aprobación

**Elaborado por:** [Nombre del responsable legal / DPO]  
**Fecha:** 16 de enero de 2026

**Revisado por:** [Nombre del CTO]  
**Fecha:** 16 de enero de 2026

**Aprobado por:** [Nombre del CEO]  
**Fecha:** 16 de enero de 2026

### 9.2. Seguimiento

- **Revisión del análisis:** Semestral (cada 6 meses)
- **Próxima revisión:** 16 de julio de 2026
- **Triggers para revisión extraordinaria:**
  - Nuevos tratamientos de datos
  - Cambios en infraestructura (nuevos subencargados)
  - Incidente de seguridad grave
  - Cambios legislativos (RGPD, guías de AEPD)

---

**FIN DEL ANÁLISIS DE RIESGOS**

**Versión:** 1.0  
**Fecha:** 16 de enero de 2026
