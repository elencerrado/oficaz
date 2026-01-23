# PROCEDIMIENTO DE GESTIÓN DE BRECHAS DE SEGURIDAD
## Data Breach Response Procedure - Artículos 33 y 34 RGPD

**Versión:** 1.0  
**Fecha de aprobación:** 16 de enero de 2026  
**Última revisión:** 16 de enero de 2026  
**Próxima revisión:** 16 de enero de 2027  
**Responsable:** José Ángel García Márquez (DNI: 09055639X)

---

## 1. OBJETO Y ÁMBITO

### 1.1. Objeto

Este procedimiento establece las directrices y pasos a seguir ante una **violación de seguridad de datos personales** (data breach) en Oficaz, en cumplimiento de los **Artículos 33 y 34 del RGPD**.

### 1.2. Ámbito de aplicación

Aplica a:

- ✅ Todo el personal de Oficaz (empleados, colaboradores, administradores)
- ✅ Proveedores y subencargados con acceso a datos personales
- ✅ Cualquier sistema que procese datos personales (producción, desarrollo, backups)

### 1.3. Definición de violación de seguridad

**Violación de la seguridad de los datos personales (Art. 4.12 RGPD):**

> *"Toda violación de la seguridad que ocasione la destrucción, pérdida o alteración accidental o ilícita de datos personales transmitidos, conservados o tratados de otra forma, o la comunicación o acceso no autorizado a dichos datos."*

**Ejemplos:**

- 🔴 Acceso no autorizado a base de datos de empleados
- 🔴 Robo o pérdida de dispositivos con datos personales
- 🔴 Ransomware que cifra datos de clientes
- 🔴 Fuga de datos por configuración errónea (buckets S3 públicos)
- 🔴 Ataque de phishing que compromete credenciales de administradores
- 🔴 Eliminación accidental de datos sin backup
- 🔴 Envío de documentos a destinatario equivocado
- 🔴 Modificación no autorizada de fichajes de empleados
- 🔴 Exfiltración de datos por empleado desleal
- 🔴 Vulnerabilidad zero-day explotada en infraestructura

### 1.4. Clasificación de brechas (según impacto en confidencialidad, integridad, disponibilidad)

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Confidencialidad** | Acceso no autorizado o divulgación de datos | Hackeo de BBDD, fuga de ficheros |
| **Integridad** | Modificación no autorizada de datos | Alteración de fichajes, modificación de salarios |
| **Disponibilidad** | Pérdida o destrucción de datos (temporal/permanente) | Ransomware, eliminación accidental |

---

## 2. EQUIPO DE RESPUESTA A INCIDENTES (CSIRT)

### 2.1. Composición del equipo

| Rol | Responsable | Contacto | Responsabilidades |
|-----|-------------|----------|-------------------|
| **Líder de incidente** | José Ángel García Márquez | soy@oficaz.es / +34 614 028 600 | Coordinación general, toma de decisiones, investigación técnica, asesoría legal |

### 2.2. Contactos de emergencia

**Interno:**
- Email urgente: `soy@oficaz.es`
- Teléfono 24/7: +34 614 028 600
- Responsable único: José Ángel García Márquez

**Externo:**
- **AEPD (Agencia Española de Protección de Datos):**
  - Notificación de brechas: https://www.aepd.es/es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/brechas-de-datos-personales
  - Teléfono: 901 100 099
  - Sede: C/ Jorge Juan, 6 - 28001 Madrid

- **INCIBE (Instituto Nacional de Ciberseguridad):**
  - Incidentes de ciberseguridad: https://www.incibe.es
  - Teléfono: 017 (línea de ayuda en ciberseguridad)

- **Asesor legal externo:**
  - [Nombre del bufete]
  - [Teléfono de emergencia]

- **Empresa forense (si procede):**
  - [Nombre de empresa de análisis forense]
  - [Contacto]

---

## 3. FASES DEL PROCEDIMIENTO

### FASE 1: DETECCIÓN Y REGISTRO (Tiempo 0)

**3.1. Canales de detección**

Una violación de seguridad puede detectarse mediante:

- 🔍 Sistemas de monitorización automática (alertas de logs, IDS/IPS)
- 🔍 Auditorías de seguridad internas
- 🔍 Informes de empleados (sospecha de actividad anómala)
- 🔍 Notificación de clientes (ej: "he visto datos de otro empleado")
- 🔍 Notificación de proveedores (ej: Railway/Cloudflare reporta intrusión)
- 🔍 Medios de comunicación o redes sociales (fuga pública)
- 🔍 Autoridad de control (AEPD nos informa)

**3.2. Reporte inicial**

Cualquier persona que detecte una posible brecha debe:

1. **NO intentar solucionar por su cuenta** (riesgo de alterar evidencias)
2. **Reportar inmediatamente** a:
   - Email: `security@oficaz.es` con asunto "**URGENTE - POSIBLE BRECHA DE SEGURIDAD**"
   - Llamar al teléfono de guardia: [Número 24/7]
   - Notificar al responsable directo

3. **Información inicial a proporcionar:**
   - ¿Qué ha ocurrido? (descripción breve)
   - ¿Cuándo se detectó? (fecha/hora)
   - ¿Quién lo detectó?
   - ¿Qué sistemas están afectados?
   - ¿Hay datos personales involucrados? (sí/no/no sé)
   - ¿Evidencias disponibles? (capturas, logs, emails)

**3.3. Registro inmediato**

El **Líder de incidente** abre un **Registro de Violación de Seguridad** (plantilla en Anexo I) con:

- ID del incidente: `BREACH-YYYY-MM-DD-XXX` (ej: BREACH-2026-01-16-001)
- Fecha/hora de detección
- Persona que detectó
- Descripción inicial
- Estado: "EN INVESTIGACIÓN"

**Registro centralizado en:**
- 📁 Carpeta segura: `/docs/security/incidents/`
- 📊 Hoja de cálculo protegida: `Registro_Brechas_Seguridad.xlsx`
- ⚠️ **NO en sistemas accesibles por toda la empresa** (confidencialidad)

---

### FASE 2: EVALUACIÓN INICIAL (0-6 horas)

**3.4. Activación del equipo**

El Líder de incidente convoca al equipo CSIRT mediante:

- Email urgente a todos los miembros
- Llamada telefónica (si fuera de horario)
- Reunión de emergencia (presencial o videollamada)

**3.5. Evaluación de la gravedad**

El equipo evalúa:

**A) Alcance de la brecha**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Qué tipo de datos están afectados? | (Ej: DNI, emails, fichajes, geolocalización, nóminas) |
| ¿Cuántos interesados afectados? | (Ej: 1 empleado, 50 empleados, 500 empleados) |
| ¿Cuántas empresas cliente afectadas? | (Ej: 1 empresa, todas las empresas) |
| ¿Son datos de categorías especiales (Art. 9 RGPD)? | ☐ Sí ☐ No (bajas médicas, geolocalización) |
| ¿Hay datos de menores? | ☐ Sí ☐ No |

**B) Tipo de violación**

- ☐ **Confidencialidad:** Acceso/divulgación no autorizada
- ☐ **Integridad:** Modificación no autorizada
- ☐ **Disponibilidad:** Pérdida o destrucción de datos

**C) Causa probable**

- ☐ Ataque externo (hackeo, ransomware)
- ☐ Error humano interno (envío a destinatario equivocado, borrado accidental)
- ☐ Fallo técnico (bug de software, caída de servidor)
- ☐ Vulnerabilidad de seguridad explotada
- ☐ Proveedor externo (Railway, Cloudflare, etc.)
- ☐ Desconocida (en investigación)

**D) Riesgo para los derechos y libertades de los interesados**

| Nivel de riesgo | Criterios | Ejemplos |
|-----------------|-----------|----------|
| **BAJO** | Impacto limitado, datos no sensibles, pocas personas | - Fuga de emails de 5 empleados<br>- Modificación de un fichaje sin consecuencias |
| **MEDIO** | Impacto moderado, más personas, datos algo sensibles | - Acceso no autorizado a fichajes de 50 empleados<br>- Fuga de teléfonos y direcciones |
| **ALTO** | Impacto significativo, datos sensibles, muchas personas | - Acceso a DNIs, nóminas de 200 empleados<br>- Geolocalización sin consentimiento<br>- Ransomware que cifra toda la BBDD |
| **MUY ALTO** | Riesgo grave, datos muy sensibles, consecuencias graves | - Fuga de datos de salud (bajas médicas con diagnóstico)<br>- Exfiltración masiva con identidad robada<br>- Publicación de datos en dark web |

**Consecuencias potenciales a evaluar:**

- 🔸 Discriminación
- 🔸 Usurpación de identidad
- 🔸 Fraude financiero
- 🔸 Daño a la reputación
- 🔸 Pérdida de confidencialidad de secreto profesional
- 🔸 Pérdida de control sobre datos personales
- 🔸 Limitación de derechos
- 🔸 Vulnerabilidad económica o social

**3.6. Decisión de notificación**

Según **Art. 33.1 RGPD:**

> "En caso de violación de la seguridad de los datos personales, el responsable del tratamiento la notificará a la autoridad de control competente [...] **sin dilación indebida** y, de ser posible, **a más tardar 72 horas** después de que haya tenido constancia de ella, **a menos que sea improbable que dicha violación constituya un riesgo para los derechos y libertades** de las personas físicas."

**Criterio de decisión:**

| Riesgo | Notificación a AEPD (Art. 33) | Notificación a interesados (Art. 34) |
|--------|-------------------------------|--------------------------------------|
| BAJO | ❌ NO obligatoria (discrecional) | ❌ NO obligatoria |
| MEDIO | ✅ SÍ obligatoria (<72h) | ❌ NO obligatoria (salvo criterio AEPD) |
| ALTO | ✅ SÍ obligatoria (<72h) | ✅ SÍ obligatoria "sin dilación indebida" |
| MUY ALTO | ✅ SÍ obligatoria (<72h) | ✅ SÍ obligatoria "sin dilación indebida" |

**IMPORTANTE:**

- **DUDA = NOTIFICAR:** Ante la duda, siempre es preferible notificar a la AEPD
- **Documentar siempre:** Incluso si se decide NO notificar, documentar las razones

**3.7. Informe de evaluación inicial**

Completar el **Informe de Evaluación Inicial** (Anexo II) con:

- Resumen del incidente
- Alcance (número de afectados, tipos de datos)
- Riesgo para interesados (bajo/medio/alto/muy alto)
- Decisión de notificación (Sí/No + justificación)
- Plan de contención inmediata

---

### FASE 3: CONTENCIÓN Y PRESERVACIÓN DE EVIDENCIAS (0-12 horas)

**3.8. Contención inmediata**

**Objetivo:** Detener la brecha y prevenir daños adicionales.

**Acciones según tipo de brecha:**

| Tipo de brecha | Acciones de contención |
|----------------|------------------------|
| **Acceso no autorizado a BBDD** | - Cambiar credenciales de acceso (DB admin, usuarios comprometidos)<br>- Revocar tokens de sesión activos<br>- Bloquear IPs sospechosas en firewall<br>- Activar modo de solo lectura si procede<br>- Desconectar sistema afectado de red (si es crítico) |
| **Ransomware** | - Aislar servidores infectados (desconectar de red)<br>- NO pagar rescate (política de empresa)<br>- Activar plan de recuperación desde backups<br>- Notificar a proveedores (Railway, Cloudflare) |
| **Fuga de documentos (email)** | - Revocar acceso a URLs firmadas<br>- Contactar con destinatario para solicitar eliminación<br>- Si es público, contactar con hosting/redes sociales para takedown |
| **Error humano (envío equivocado)** | - Contactar inmediatamente con destinatario<br>- Solicitar eliminación del email/documento<br>- Confirmar eliminación por escrito |
| **Vulnerabilidad explotada** | - Parchear vulnerabilidad inmediatamente<br>- Reiniciar servicios afectados<br>- Cambiar todas las credenciales |
| **Proveedor comprometido** | - Contactar con proveedor (Railway, Stripe, Cloudflare)<br>- Seguir sus instrucciones<br>- Evaluar cambio de proveedor si es grave |

**3.9. Preservación de evidencias**

**CRÍTICO:** No alterar evidencias que puedan ser necesarias para investigación policial, judicial o de la AEPD.

**Acciones:**

1. **Logs de sistema:**
   - Exportar logs de acceso, autenticación, base de datos
   - Almacenar en ubicación segura (fuera del sistema comprometido)
   - Calcular hash SHA-256 de cada archivo de log (integridad)

2. **Capturas de pantalla:**
   - Capturar estado del sistema en el momento de la detección
   - Mensajes de error, alertas de seguridad

3. **Emails y comunicaciones:**
   - Guardar emails de phishing, notificaciones de usuarios
   - Mensajes en sistemas de comunicación interna

4. **Base de datos:**
   - Snapshot de BBDD en el momento de la brecha (si es posible sin interferir)
   - Backup inmediato (separado de los backups regulares)

5. **Acceso físico:**
   - Si hay acceso físico no autorizado, no tocar equipos (pueden contener huellas)
   - Llamar a policía/empresa forense

6. **Cadena de custodia:**
   - Documentar quién accede a las evidencias, cuándo y para qué
   - Firmar digitalmente archivos de evidencia

**3.10. Comunicación interna**

- **Informar al equipo:** Solo las personas necesarias (principio de "need to know")
- **NO difundir públicamente:** Hasta que se haya evaluado y decidido estrategia de comunicación
- **Confidencialidad:** Recordar a todos los involucrados el deber de confidencialidad

---

### FASE 4: NOTIFICACIÓN A AUTORIDAD DE CONTROL - AEPD (Máximo 72 horas)

**3.11. Preparación de la notificación**

Si se decidió notificar a la AEPD en la Fase 2, preparar la información requerida por **Art. 33.3 RGPD:**

**Contenido obligatorio:**

a) **Descripción de la naturaleza de la violación:**
   - Tipo de brecha (confidencialidad/integridad/disponibilidad)
   - Cómo ocurrió (causa)
   - Cuándo se detectó (fecha/hora)

b) **Nombre y datos de contacto del DPO o punto de contacto:**
   - Nombre: [Nombre del DPO o responsable]
   - Email: info@oficaz.es
   - Teléfono: [Teléfono]

c) **Descripción de las posibles consecuencias de la violación:**
   - Riesgo para derechos y libertades (discriminación, fraude, etc.)
   - Impacto en empleados afectados
   - Impacto en empresas cliente

d) **Descripción de las medidas adoptadas o propuestas:**
   - Medidas de contención (cambio de contraseñas, bloqueo de accesos)
   - Medidas de remediación (parcheo, mejoras de seguridad)
   - Medidas para mitigar efectos adversos (notificación a afectados, oferta de medidas compensatorias)

e) **Categorías y número aproximado de interesados afectados:**
   - Ej: "Aproximadamente 150 empleados de 5 empresas cliente"

f) **Categorías y número aproximado de registros de datos personales afectados:**
   - Ej: "500 registros de fichajes con geolocalización + 150 perfiles de empleado"

**3.12. Envío de la notificación**

**Plazo:** **Máximo 72 horas** desde que se tuvo constancia de la brecha.

**Vía de notificación a AEPD:**

**Opción A - Notificación online (recomendada):**

1. Acceder a: https://www.aepd.es/es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/brechas-de-datos-personales

2. Completar formulario electrónico de notificación de brechas

3. Adjuntar evidencias (si están disponibles)

4. Obtener justificante de presentación (guardar PDF)

**Opción B - Notificación por email:**

- Email: brechas@aepd.es (verificar en web de AEPD si está disponible)
- Asunto: "Notificación de violación de seguridad - Oficaz - [ID incidente]"

**Opción C - Notificación telefónica (urgente):**

- Teléfono: 901 100 099
- Seguido de notificación escrita

**3.13. Notificación fuera de plazo**

Si NO se puede notificar en 72 horas (ej: información incompleta, investigación compleja):

- **Notificar parcialmente** dentro de las 72h indicando:
  - Que la investigación está en curso
  - Información disponible hasta el momento
  - Que se proporcionará información adicional en fases

- **Justificar el retraso** (Art. 33.1 RGPD permite retrasos justificados)

- **Completar la notificación** tan pronto como sea posible

**3.14. Seguimiento con AEPD**

- La AEPD puede requerir información adicional
- Responder a sus requerimientos en plazos indicados
- Cooperar plenamente con la investigación
- Implementar medidas correctivas que indiquen

---

### FASE 5: NOTIFICACIÓN A INTERESADOS (Art. 34 RGPD)

**3.15. Criterio de notificación**

Según **Art. 34.1 RGPD:**

> "Cuando sea probable que la violación de la seguridad de los datos personales entrañe un **alto riesgo** para los derechos y libertades de las personas físicas, el responsable del tratamiento la comunicará al interesado **sin dilación indebida**."

**¿Cuándo notificar a los interesados?**

- ✅ **Riesgo ALTO o MUY ALTO** → Notificación obligatoria
- ❌ **Riesgo BAJO o MEDIO** → NO obligatoria (salvo criterio AEPD)

**Excepciones (NO es necesario notificar a interesados incluso con riesgo alto si):**

a) **Medidas de protección técnica y organizativa eficaces** aplicadas a los datos afectados (ej: cifrado con clave que no se ha comprometido)

b) **Medidas posteriores** que garanticen que el alto riesgo ya no es probable (ej: recuperación inmediata de datos, bloqueo del atacante)

c) **Supondría un esfuerzo desproporcionado:** En este caso, comunicación pública o medida similar (ej: aviso en web, nota de prensa)

**3.16. Contenido de la notificación a interesados**

Información a proporcionar (**Art. 34.2 RGPD**):

a) **Descripción en lenguaje claro y sencillo** de la naturaleza de la violación

b) **Nombre y datos de contacto** del DPO o punto de contacto

c) **Descripción de las posibles consecuencias** de la violación

d) **Descripción de las medidas adoptadas o propuestas** para remediar y mitigar efectos

**3.17. Canales de notificación**

**Notificación individual (preferida):**

- **Email:** A email personal/corporativo del empleado afectado
- **Comunicación en app:** Notificación urgente en panel de empleado
- **Llamada telefónica:** Si es muy grave (para verificar recepción)
- **Correo certificado:** Si no hay respuesta a email

**Notificación pública (si esfuerzo desproporcionado):**

- **Banner en aplicación:** Al acceder, aviso de brecha con enlace a información
- **Email masivo:** A todos los clientes (empresas)
- **Nota de prensa:** Si la brecha es muy grave y pública
- **Redes sociales:** Twitter, LinkedIn (comunicado oficial)

**3.18. Plantilla de notificación**

Ver **Anexo III - Plantilla de comunicación a interesados afectados**.

**3.19. Timing**

- **"Sin dilación indebida"** → Lo antes posible, preferiblemente en **24-48 horas** desde que se confirma el riesgo alto
- **NO esperar** a tener todos los detalles (se puede enviar información inicial y luego ampliar)

---

### FASE 6: INVESTIGACIÓN Y ANÁLISIS DE CAUSA RAÍZ (3-7 días)

**3.20. Investigación técnica**

**Objetivo:** Entender cómo ocurrió la brecha y por qué.

**Análisis forense:**

1. **Revisión de logs:**
   - Logs de acceso (IPs, timestamps)
   - Logs de autenticación (intentos fallidos, accesos exitosos)
   - Logs de base de datos (consultas ejecutadas, modificaciones)
   - Logs de aplicación (errores, excepciones)

2. **Identificación del vector de ataque:**
   - ¿Cómo entró el atacante? (phishing, vulnerabilidad, credenciales robadas)
   - ¿Qué herramientas usó?
   - ¿Cuánto tiempo estuvo en el sistema? (dwell time)

3. **Alcance completo:**
   - ¿Qué más pudo ver/modificar el atacante?
   - ¿Hay puertas traseras (backdoors) instaladas?
   - ¿Se exfiltraron más datos de los detectados?

4. **Pruebas de concepto:**
   - Reproducir el ataque (en entorno seguro) para entender la vulnerabilidad

**3.21. Análisis de causa raíz (Root Cause Analysis - RCA)**

**Método de los 5 porqués:**

Ejemplo:
1. ¿Por qué ocurrió la brecha? → Un atacante accedió a la base de datos
2. ¿Por qué pudo acceder? → Usó credenciales de un administrador
3. ¿Por qué obtuvo las credenciales? → El administrador cayó en un email de phishing
4. ¿Por qué no se detectó el phishing? → No hay filtro anti-phishing ni formación adecuada
5. ¿Por qué no hay formación? → **CAUSA RAÍZ:** No se priorizó la formación en seguridad

**Categorías de causa raíz:**

- ☐ **Fallo técnico:** Bug de software, configuración errónea, vulnerabilidad
- ☐ **Error humano:** Despiste, falta de atención, desconocimiento
- ☐ **Falta de controles de seguridad:** Ausencia de 2FA, filtros, monitorización
- ☐ **Proceso inadecuado:** Procedimientos no documentados, no seguidos
- ☐ **Formación insuficiente:** Personal no concienciado en seguridad
- ☐ **Ataque sofisticado:** APT (Advanced Persistent Threat), zero-day

---

### FASE 7: REMEDIACIÓN Y MEDIDAS CORRECTIVAS (7-30 días)

**3.22. Plan de remediación**

**Medidas inmediatas (ya implementadas en Fase 3):**

- ✅ Contención de la brecha
- ✅ Cambio de credenciales
- ✅ Parcheo de vulnerabilidades

**Medidas a corto plazo (7-15 días):**

Según la causa raíz identificada:

| Causa raíz | Medidas correctivas |
|------------|---------------------|
| **Credenciales débiles** | - Forzar cambio de contraseñas<br>- Implementar política de contraseñas robusta<br>- Activar 2FA obligatorio para admins |
| **Vulnerabilidad de software** | - Actualizar dependencias (`npm update`)<br>- Parches de seguridad<br>- Auditoría de código (code review) |
| **Configuración errónea** | - Revisar configuraciones de Railway, Cloudflare<br>- Hardening de servidores<br>- Checklist de configuración segura |
| **Falta de monitorización** | - Implementar alertas de seguridad (Sentry, Datadog)<br>- Logs de auditoría más detallados<br>- SIEM (Security Information and Event Management) |
| **Phishing exitoso** | - Formación anti-phishing para empleados<br>- Filtro de email más robusto<br>- Simulacros de phishing |
| **Acceso físico no autorizado** | - Revisar control de acceso a oficinas<br>- Cámaras de seguridad<br>- Registro de visitantes |

**Medidas a medio plazo (15-30 días):**

- 🔹 Pentesting externo (empresa especializada)
- 🔹 Revisión completa de arquitectura de seguridad
- 🔹 Implementación de IDS/IPS (Intrusion Detection/Prevention System)
- 🔹 Segmentación de red adicional
- 🔹 Cifrado de datos en reposo (si no está implementado)
- 🔹 Plan de respuesta a incidentes actualizado (este documento)

**Medidas a largo plazo (1-6 meses):**

- 🔹 Certificación ISO 27001
- 🔹 Bug bounty program
- 🔹 Red team exercises
- 🔹 Renovación de infraestructura (si procede)

**3.23. Implementación y verificación**

- Asignar responsables a cada medida correctiva
- Establecer plazos concretos
- Hacer seguimiento semanal del avance
- **Verificar eficacia:** Probar que la medida realmente previene la recurrencia

---

### FASE 8: DOCUMENTACIÓN Y LECCIONES APRENDIDAS (7-15 días)

**3.24. Informe post-incidente**

Completar el **Informe Final de Violación de Seguridad** (Anexo IV) con:

**1. Resumen ejecutivo:**
- ¿Qué pasó? (1 párrafo)
- Impacto (número de afectados, tipo de datos)
- Causa raíz

**2. Cronología detallada:**

| Fecha/Hora | Evento | Responsable |
|------------|--------|-------------|
| 2026-01-15 10:30 | Detección de actividad sospechosa en logs | Sistema automático |
| 2026-01-15 10:45 | Notificación a CTO | Admin de sistemas |
| 2026-01-15 11:00 | Activación de equipo CSIRT | CTO |
| 2026-01-15 12:00 | Contención de la brecha | Dev Senior |
| 2026-01-15 18:00 | Notificación a AEPD | DPO |
| ... | ... | ... |

**3. Análisis técnico:**
- Vector de ataque
- Vulnerabilidad explotada
- Datos afectados (detalles)
- Evidencias recopiladas

**4. Medidas adoptadas:**
- Contención
- Remediación
- Prevención de recurrencia

**5. Notificaciones realizadas:**
- AEPD: ✅ Sí (fecha, nº expediente) / ❌ No (justificación)
- Interesados: ✅ Sí (nº personas, fecha) / ❌ No (justificación)
- Clientes: ✅ Sí / ❌ No

**6. Lecciones aprendidas:**
- ¿Qué salió bien?
- ¿Qué salió mal?
- ¿Qué mejoraríamos?

**7. Recomendaciones:**
- Medidas de seguridad adicionales
- Cambios en procedimientos
- Formación necesaria

**3.25. Actualización del registro de brechas**

Actualizar el **Registro de Violaciones de Seguridad** (Anexo I) con:

- Estado final: "CERRADO" + fecha de cierre
- Resumen de resolución
- Enlace al informe post-incidente completo

**3.26. Sesión de lecciones aprendidas**

**Reunión de equipo (presencial):**

- Fecha: Máximo 15 días tras cierre del incidente
- Asistentes: Equipo CSIRT + otros involucrados
- Agenda:
  1. Revisión de cronología
  2. Identificación de aciertos y errores
  3. Propuestas de mejora
  4. Actualización de procedimientos

**Resultado:** Lista de acciones para evitar recurrencia.

---

## 4. NOTIFICACIÓN A CLIENTES (EMPRESAS) - ROL DE ENCARGADO

**4.1. Oficaz como Encargado del Tratamiento**

Cuando Oficaz actúa como **Encargado** (tratando datos de empleados por cuenta de empresas cliente), tiene la obligación de **notificar al Responsable (empresa cliente) sin dilación indebida** según **Art. 33.2 RGPD:**

> "El encargado del tratamiento notificará sin dilación indebida al responsable del tratamiento toda violación de la seguridad de los datos personales de la que tenga conocimiento."

**4.2. Plazo de notificación al responsable**

- **Máximo 24 horas** tras tener constancia de la brecha (más exigente que las 72h de AEPD)
- **Aunque sea información parcial** → Notificar lo que se sabe y actualizar después

**4.3. Contenido de la notificación al cliente (responsable)**

**Email urgente con:**

a) **Descripción de la brecha:**
   - Qué ocurrió
   - Cuándo se detectó
   - Sistemas afectados

b) **Datos afectados de su empresa:**
   - ¿Se han visto afectados datos de sus empleados? Sí/No
   - Si sí, cuántos empleados aproximadamente
   - Qué tipo de datos (fichajes, documentos, perfiles, etc.)

c) **Medidas de contención adoptadas:**
   - Qué hemos hecho para detener la brecha
   - Estado actual del sistema

d) **Riesgo para sus empleados:**
   - Evaluación inicial de riesgo (bajo/medio/alto)
   - Posibles consecuencias

e) **Asistencia de Oficaz:**
   - Cómo vamos a ayudar al cliente
   - Información adicional que proporcionaremos
   - Contacto directo para dudas

f) **Obligaciones del cliente (responsable):**
   - Recordar que es el RESPONSABLE quien decide si notifica a AEPD
   - Recordar el plazo de 72 horas
   - Ofrecer asistencia para la notificación

**Plantilla:** Ver **Anexo V - Notificación a empresa cliente (responsable del tratamiento)**.

**4.4. Asistencia al cliente para notificación a AEPD**

Si el cliente decide notificar a AEPD, Oficaz proporcionará:

- ✅ Informe técnico detallado de la brecha
- ✅ Listado de datos afectados de sus empleados
- ✅ Cronología de eventos
- ✅ Medidas de seguridad implementadas
- ✅ Evidencias disponibles (si procede)
- ✅ Asistencia en la redacción de la notificación

**Sin coste adicional** (obligación del encargado según Contrato de Encargo).

---

## 5. REGISTRO DE VIOLACIONES DE SEGURIDAD

**5.1. Obligación de registro (Art. 33.5 RGPD)**

> "El responsable del tratamiento documentará **cualquier violación** de la seguridad de los datos personales, incluidos los hechos relacionados con ella, sus efectos y las medidas correctivas adoptadas."

**Importante:** Se deben registrar **TODAS** las violaciones, incluso las que NO requieren notificación a AEPD.

**5.2. Contenido del registro**

Para cada violación, documentar:

- ✅ ID del incidente
- ✅ Fecha y hora de detección
- ✅ Descripción de la violación
- ✅ Categorías de datos afectados
- ✅ Número aproximado de interesados afectados
- ✅ Tipo de violación (confidencialidad/integridad/disponibilidad)
- ✅ Causa raíz
- ✅ Riesgo para interesados (bajo/medio/alto/muy alto)
- ✅ Medidas de contención adoptadas
- ✅ Medidas correctivas implementadas
- ✅ Notificación a AEPD (Sí/No + fecha + nº expediente)
- ✅ Notificación a interesados (Sí/No + fecha + nº personas)
- ✅ Notificación a clientes (Sí + fecha + nº empresas)
- ✅ Estado (En investigación / Contenido / Remediado / Cerrado)
- ✅ Fecha de cierre
- ✅ Responsable del incidente
- ✅ Enlace a informe post-incidente

**5.3. Herramienta de registro**

- 📊 **Hoja de cálculo:** `docs/security/Registro_Brechas_Seguridad.xlsx`
- 📁 **Carpeta de incidentes:** `docs/security/incidents/BREACH-YYYY-MM-DD-XXX/`

**Acceso:** Solo CTO, DPO, responsable de seguridad.

**Conservación:** Indefinida (para demostrar cumplimiento ante AEPD).

**5.4. Auditoría del registro**

- **AEPD puede solicitar el registro** en cualquier momento
- Debe estar disponible en formato electrónico
- Debe ser demostrable la veracidad de los datos

---

## 6. FORMACIÓN Y CONCIENCIACIÓN

**6.1. Formación inicial**

Todo empleado que tenga acceso a datos personales debe recibir formación sobre:

- ✅ Qué es una violación de seguridad
- ✅ Ejemplos de brechas comunes
- ✅ Cómo detectar actividades sospechosas
- ✅ Cómo reportar un incidente (email, teléfono)
- ✅ Qué NO hacer (no tocar evidencias, no intentar solucionar solo)
- ✅ Importancia de la confidencialidad

**Duración:** 1 hora  
**Frecuencia:** Al incorporarse + anual

**6.2. Formación específica para equipo CSIRT**

- Análisis forense básico
- Respuesta a incidentes (metodología)
- Normativa RGPD (Art. 33 y 34 en profundidad)
- Simulacros de brechas

**Duración:** 4 horas  
**Frecuencia:** Semestral

**6.3. Simulacros**

**Objetivo:** Probar el plan de respuesta en condiciones controladas.

**Frecuencia:** 1 vez al año

**Escenarios:**

- 🎭 Ataque de ransomware
- 🎭 Empleado cae en phishing y compromete credenciales
- 🎭 Fuga de datos por envío de email a destinatario equivocado
- 🎭 Hackeo de cuenta de administrador

**Evaluación:**
- ¿Se detectó en tiempo razonable?
- ¿Se activó el equipo correctamente?
- ¿Se siguió el procedimiento?
- ¿Se cumplieron los plazos de notificación simulados?

**Informe de simulacro:** Documentar lecciones aprendidas y mejorar el procedimiento.

---

## 7. REVISIÓN Y ACTUALIZACIÓN DEL PROCEDIMIENTO

**7.1. Revisión periódica**

- **Frecuencia:** Anual (mínimo)
- **Responsable:** DPO / Responsable de Seguridad
- **Triggers adicionales para revisión:**
  - Tras cada incidente real
  - Cambios en el RGPD o guías de AEPD
  - Cambios en la infraestructura de Oficaz
  - Nuevos subencargados
  - Feedback de simulacros

**7.2. Control de versiones**

- Versión actual: 1.0 (16/01/2026)
- Histórico de versiones guardado en Git

**7.3. Aprobación**

- Aprobado por: [Nombre del CEO / CTO]
- Fecha: 16 de enero de 2026
- Próxima revisión: 16 de enero de 2027

---

## ANEXOS

### ANEXO I - REGISTRO DE VIOLACIÓN DE SEGURIDAD (PLANTILLA)

**ID del incidente:** BREACH-YYYY-MM-DD-XXX

**SECCIÓN 1: DETECCIÓN**

- **Fecha y hora de detección:** ____________________
- **Persona que detectó:** ____________________
- **Canal de detección:** ☐ Sistema automático ☐ Empleado ☐ Cliente ☐ Proveedor ☐ Otro: ______

**SECCIÓN 2: DESCRIPCIÓN INICIAL**

- **¿Qué ocurrió?** (descripción breve)

  _________________________________________________________________

- **¿Cuándo ocurrió?** (fecha/hora estimada del incidente, no de la detección)

  _________________________________________________________________

- **¿Qué sistemas están afectados?**

  _________________________________________________________________

**SECCIÓN 3: CLASIFICACIÓN**

- **Tipo de violación:**
  - ☐ Confidencialidad (acceso/divulgación no autorizada)
  - ☐ Integridad (modificación no autorizada)
  - ☐ Disponibilidad (pérdida/destrucción de datos)

- **Causa probable:**
  - ☐ Ataque externo
  - ☐ Error humano interno
  - ☐ Fallo técnico
  - ☐ Vulnerabilidad explotada
  - ☐ Proveedor externo
  - ☐ Desconocida

**SECCIÓN 4: DATOS AFECTADOS**

- **Categorías de datos:**
  - ☐ Identificación (nombre, DNI)
  - ☐ Contacto (email, teléfono, dirección)
  - ☐ Fichajes (horas, geolocalización)
  - ☐ Documentos (nóminas, contratos)
  - ☐ Vacaciones
  - ☐ Mensajes
  - ☐ Contraseñas (hasheadas/texto plano)
  - ☐ Otros: _______________

- **¿Datos de categorías especiales (Art. 9)?** ☐ Sí ☐ No
  - Si sí, especificar: _______________________

- **Número aproximado de interesados afectados:** _______

- **Número de empresas cliente afectadas:** _______

**SECCIÓN 5: EVALUACIÓN DE RIESGO**

- **Nivel de riesgo para interesados:**
  - ☐ BAJO
  - ☐ MEDIO
  - ☐ ALTO
  - ☐ MUY ALTO

- **Justificación del nivel de riesgo:**

  _________________________________________________________________

**SECCIÓN 6: DECISIÓN DE NOTIFICACIÓN**

- **Notificación a AEPD (Art. 33):** ☐ SÍ ☐ NO
  - Si SÍ, fecha de notificación: __________
  - Nº expediente AEPD: __________
  - Si NO, justificación: _______________________

- **Notificación a interesados (Art. 34):** ☐ SÍ ☐ NO
  - Si SÍ, fecha de notificación: __________
  - Nº personas notificadas: __________
  - Canal: ☐ Email ☐ App ☐ Teléfono ☐ Correo ☐ Público
  - Si NO, justificación: _______________________

- **Notificación a clientes (Art. 33.2):** ☐ SÍ ☐ N/A
  - Si SÍ, fecha: __________
  - Nº empresas notificadas: __________

**SECCIÓN 7: CONTENCIÓN Y REMEDIACIÓN**

- **Medidas de contención adoptadas:**

  _________________________________________________________________

- **Medidas correctivas implementadas:**

  _________________________________________________________________

- **Causa raíz identificada:**

  _________________________________________________________________

**SECCIÓN 8: ESTADO**

- **Estado actual:**
  - ☐ En investigación
  - ☐ Contenido
  - ☐ Remediado
  - ☐ Cerrado

- **Fecha de cierre:** __________

- **Responsable del incidente:** __________

- **Enlace a informe post-incidente:** __________

---

### ANEXO II - INFORME DE EVALUACIÓN INICIAL (PLANTILLA)

*(Completar en las primeras 6 horas)*

**ID del incidente:** BREACH-YYYY-MM-DD-XXX

**1. RESUMEN EJECUTIVO**

En [fecha] a las [hora], se detectó una posible violación de seguridad consistente en [descripción breve]. Se estima que afecta a [número] interesados, cuyos datos de [tipos de datos] podrían haberse visto comprometidos.

**2. CRONOLOGÍA PRELIMINAR**

| Hora | Evento |
|------|--------|
|      |        |

**3. ALCANCE ESTIMADO**

- **Interesados afectados:** Aproximadamente ___ personas
- **Empresas cliente afectadas:** Aproximadamente ___ empresas
- **Tipos de datos afectados:** [Lista]
- **Periodo temporal afectado:** Desde [fecha] hasta [fecha]

**4. TIPO DE VIOLACIÓN**

☐ Confidencialidad ☐ Integridad ☐ Disponibilidad

**5. CAUSA PROBABLE**

[Descripción de la causa probable con la información disponible]

**6. RIESGO PARA INTERESADOS**

**Nivel de riesgo:** ☐ BAJO ☐ MEDIO ☐ ALTO ☐ MUY ALTO

**Justificación:**

[Explicar por qué se considera ese nivel de riesgo, mencionando posibles consecuencias]

**7. DECISIÓN DE NOTIFICACIÓN**

- **Notificación a AEPD:** ☐ SÍ ☐ NO ☐ POR DETERMINAR
- **Notificación a interesados:** ☐ SÍ ☐ NO ☐ POR DETERMINAR
- **Notificación a clientes:** ☐ SÍ ☐ NO ☐ N/A

**Justificación:**

[Explicar la decisión basándose en Art. 33 y 34 RGPD]

**8. PLAN DE CONTENCIÓN INMEDIATA**

[Acciones a tomar en las próximas horas para contener la brecha]

**9. PRÓXIMOS PASOS**

[Plan para las próximas 24-72 horas]

---

**Elaborado por:** __________  
**Fecha y hora:** __________  
**Aprobado por:** __________ (Líder de incidente)

---

### ANEXO III - PLANTILLA DE COMUNICACIÓN A INTERESADOS AFECTADOS

**Asunto:** IMPORTANTE - Notificación de incidente de seguridad - Oficaz

---

Estimado/a [Nombre del empleado],

Le escribimos para informarle sobre un **incidente de seguridad** que ha afectado a algunos datos personales almacenados en la plataforma Oficaz.

**¿Qué ha ocurrido?**

El [fecha], detectamos [descripción en lenguaje claro del incidente]. Como resultado, es posible que algunos de sus datos personales hayan estado expuestos.

**¿Qué datos están afectados?**

Los datos que pueden haberse visto afectados son:

- [Lista de tipos de datos: ej. nombre, email, fichajes, etc.]

**NO se han visto afectados:** [Datos que NO están comprometidos, si es relevante tranquilizar]

**¿Cuál es el riesgo para usted?**

[Explicación de las posibles consecuencias: ej. "Podría recibir correos de phishing usando su nombre", "Sus datos de fichajes podrían haber sido vistos por terceros", etc.]

**¿Qué hemos hecho?**

Inmediatamente:

- [Medida 1: ej. "Bloqueamos el acceso no autorizado"]
- [Medida 2: ej. "Cambiamos todas las contraseñas de administradores"]
- [Medida 3: ej. "Reforzamos las medidas de seguridad"]
- Hemos notificado el incidente a la **Agencia Española de Protección de Datos (AEPD)**.

**¿Qué puede hacer usted?**

Le recomendamos:

- ☑️ **Cambiar su contraseña** en Oficaz (si aplica)
- ☑️ **Estar alerta** ante correos o llamadas sospechosas que mencionen Oficaz
- ☑️ **NO proporcionar datos personales** a nadie que se identifique como Oficaz sin verificar su identidad
- ☑️ **Contactarnos** si observa cualquier actividad inusual en su cuenta

**¿Dónde puede obtener más información o ejercer sus derechos?**

Si tiene preguntas o desea ejercer sus derechos (acceso, rectificación, supresión, etc.), puede contactarnos:

- **Email:** info@oficaz.es
- **Teléfono:** [Teléfono]
- **Contacto de protección de datos:** [Nombre del DPO] - [Email]

También puede presentar una reclamación ante la **Agencia Española de Protección de Datos (AEPD)**:

- Web: www.aepd.es
- Teléfono: 901 100 099
- Dirección: C/ Jorge Juan, 6 - 28001 Madrid

**Pedimos disculpas**

Lamentamos sinceramente este incidente y las molestias que pueda causarle. Estamos comprometidos con la protección de sus datos personales y hemos reforzado nuestras medidas de seguridad para evitar que esto vuelva a ocurrir.

Atentamente,

[Nombre del responsable]  
[Cargo]  
Oficaz - Software de Gestión Laboral  
info@oficaz.es

---

**Nota:** Esta comunicación se envía en cumplimiento del **Artículo 34 del RGPD** (Reglamento General de Protección de Datos).

---

### ANEXO IV - INFORME POST-INCIDENTE (PLANTILLA COMPLETA)

*(Ver documento separado: `docs/security/incidents/BREACH-YYYY-MM-DD-XXX/Informe_Post_Incidente.pdf`)*

**Estructura:**

1. Resumen ejecutivo
2. Cronología detallada
3. Análisis técnico
4. Causa raíz (RCA)
5. Medidas de contención
6. Medidas correctivas
7. Notificaciones realizadas
8. Lecciones aprendidas
9. Recomendaciones
10. Anexos (evidencias, logs, capturas)

---

### ANEXO V - NOTIFICACIÓN A EMPRESA CLIENTE (RESPONSABLE DEL TRATAMIENTO)

**Asunto:** URGENTE - Notificación de violación de seguridad - Oficaz (Art. 33.2 RGPD)

---

**Para:** [Email del responsable de la empresa cliente]  
**Asunto:** URGENTE - Notificación de violación de seguridad - Oficaz (Art. 33.2 RGPD)  
**Fecha:** [Fecha y hora]

---

Estimado/a [Nombre del responsable],

En cumplimiento del **Artículo 33.2 del RGPD**, le notificamos **sin dilación indebida** una violación de la seguridad de los datos personales detectada en la plataforma Oficaz.

**1. DESCRIPCIÓN DE LA VIOLACIÓN**

El [fecha] a las [hora], detectamos [descripción del incidente].

**Tipo de violación:** ☐ Confidencialidad ☐ Integridad ☐ Disponibilidad

**2. DATOS DE SU EMPRESA AFECTADOS**

- **¿Se han visto afectados datos de sus empleados?** ☐ SÍ ☐ NO

**Si SÍ:**

- **Número aproximado de empleados afectados:** ___ personas
- **Categorías de datos afectados:**
  - ☐ Identificación (nombre, DNI)
  - ☐ Contacto (email, teléfono)
  - ☐ Fichajes (horas, geolocalización)
  - ☐ Documentos (nóminas, contratos)
  - ☐ Vacaciones
  - ☐ Mensajes
  - ☐ Otros: _______________

- **Periodo afectado:** Desde [fecha] hasta [fecha]

**3. MEDIDAS DE CONTENCIÓN ADOPTADAS POR OFICAZ**

[Lista de acciones inmediatas tomadas para detener la brecha]

**Estado actual:** El sistema está [operativo/parcialmente operativo/fuera de servicio] con las medidas de seguridad reforzadas.

**4. RIESGO PARA SUS EMPLEADOS (INTERESADOS)**

**Evaluación preliminar de riesgo:** ☐ BAJO ☐ MEDIO ☐ ALTO ☐ MUY ALTO

**Posibles consecuencias:**

[Descripción de los riesgos para los empleados afectados]

**5. SUS OBLIGACIONES COMO RESPONSABLE DEL TRATAMIENTO**

Le recordamos que, como **Responsable del Tratamiento**, usted debe evaluar si es necesario:

a) **Notificar a la AEPD (Art. 33.1 RGPD):**
   - Plazo: **Máximo 72 horas** desde que tuvo constancia (hoy)
   - Obligatorio si hay riesgo para derechos y libertades de sus empleados

b) **Notificar a los interesados (Art. 34.1 RGPD):**
   - Obligatorio si hay **alto riesgo** para derechos y libertades
   - Sin dilación indebida

**6. ASISTENCIA DE OFICAZ**

Como Encargado del Tratamiento, ponemos a su disposición:

- ✅ Informe técnico detallado (adjunto o disponible en [enlace])
- ✅ Listado de empleados afectados de su empresa
- ✅ Asistencia para la notificación a AEPD (redacción, documentación)
- ✅ Plantilla de comunicación a empleados afectados
- ✅ Soporte técnico prioritario

**Contacto directo para este incidente:**

- Email: security@oficaz.es (o info@oficaz.es)
- Teléfono: [Teléfono urgente 24/7]
- Responsable: [Nombre del líder de incidente]

**7. INFORMACIÓN ADICIONAL**

Le mantendremos informado de:

- Avances en la investigación
- Causa raíz identificada
- Medidas correctivas implementadas
- Cierre del incidente

**Próxima actualización:** [Fecha estimada]

**8. DECLARACIÓN**

Oficaz lamenta profundamente este incidente y está comprometida con la máxima transparencia y colaboración. Estamos a su entera disposición para asistirle en el cumplimiento de sus obligaciones legales.

Atentamente,

[Nombre del CTO / DPO]  
[Cargo]  
Oficaz - Software de Gestión Laboral  
security@oficaz.es (o info@oficaz.es)  
[Teléfono]

---

**Adjuntos:**

- Informe técnico preliminar (PDF)
- Listado de empleados afectados de su empresa (Excel cifrado con contraseña)
- Plantilla de comunicación a empleados (Word)

---

**FIN DEL PROCEDIMIENTO**

Este procedimiento ha sido elaborado en cumplimiento del **RGPD** (Artículos 33, 34) y las **Guías de la AEPD** sobre notificación de brechas de seguridad.

**Aprobado por:** [Nombre]  
**Cargo:** [CEO / CTO / DPO]  
**Fecha:** 16 de enero de 2026

**Próxima revisión:** 16 de enero de 2027
