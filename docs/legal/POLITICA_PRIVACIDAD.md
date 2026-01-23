# POLÍTICA DE PRIVACIDAD - OFICAZ

**Última actualización:** 16 de enero de 2026

---

## 1. RESPONSABLE DEL TRATAMIENTO

**Identidad:**  
Oficaz - Software de Gestión Laboral  
**NIF:** 09055639X  
**Dirección:** Avd. Clara Campoamor 4, Blq. 7 5º4 21920 San Juan de Aznalfarache (Sevilla)  
**Email de contacto:** soy@oficaz.es  
**Teléfono:** +34 614 028 600  
**Representante Legal:** José Ángel García Márquez  
**Delegado de Protección de Datos (DPO):** José Ángel García Márquez (acumula funciones)

---

## 2. FINALIDAD Y BASE JURÍDICA DEL TRATAMIENTO

### 2.1. DATOS DE EMPRESAS CLIENTES (Responsables del Tratamiento)

**Finalidades:**
- Gestión de cuenta y suscripción al servicio
- Facturación y cobros
- Soporte técnico y atención al cliente
- Comunicaciones comerciales (solo con consentimiento)
- Cumplimiento de obligaciones legales (contables, fiscales)

**Base jurídica:**
- Ejecución del contrato de prestación de servicios
- Obligación legal (facturación, normativa fiscal)
- Interés legítimo (mejora del servicio, seguridad)
- Consentimiento (marketing)

**Datos tratados:**
- Datos de la empresa: Nombre, CIF, dirección fiscal, email, teléfono
- Datos del contacto: Nombre completo, email, teléfono
- Datos de facturación: Dirección, código postal, país
- Datos de pago: Método de pago, últimos 4 dígitos de tarjeta (gestionado por Stripe)
- Datos de uso: Estadísticas de uso del servicio, logs de acceso
- Datos de soporte: Historial de tickets, conversaciones

---

### 2.2. DATOS DE EMPLEADOS DE EMPRESAS CLIENTES (Encargados del Tratamiento)

**IMPORTANTE:** Oficaz actúa como **ENCARGADO DEL TRATAMIENTO** de los datos de empleados. Las empresas clientes son los **RESPONSABLES DEL TRATAMIENTO** y deben informar a sus trabajadores según el modelo incluido en la Sección 7.

**Finalidades del tratamiento por cuenta de las empresas clientes:**
- Gestión de jornada laboral (fichajes, descansos)
- Control horario (cumplimiento RD-ley 8/2019)
- Gestión de vacaciones y ausencias
- Gestión documental (nóminas, contratos, documentos laborales)
- Comunicaciones internas empresa-empleado
- Firma digital de documentos
- Recordatorios y notificaciones

**Base jurídica (de la empresa cliente):**
- Ejecución del contrato laboral
- Obligación legal (control horario RD-ley 8/2019, Estatuto de los Trabajadores)
- Interés legítimo (organización del trabajo)
- Consentimiento (geolocalización, fotos de perfil opcionales)

**Datos tratados de empleados:**

**Datos identificativos:**
- Nombre completo
- DNI/NIE
- Email personal y/o corporativo
- Teléfono personal y/o corporativo
- Dirección postal
- Fotografía de perfil (opcional, con consentimiento)
- Firma digital (opcional)

**Datos laborales:**
- Puesto de trabajo
- Fecha de alta
- Rol en la aplicación (admin/manager/empleado)
- Estado laboral (activo/inactivo/de vacaciones/baja)

**Datos de control horario:**
- Fecha y hora de fichaje de entrada/salida
- Duración de jornada laboral
- Descansos
- Geolocalización al fichar (solo con consentimiento explícito GDPR)
- Dispositivo utilizado para fichar
- Historial de modificaciones (audit trail RD-ley 8/2019)

**Datos de vacaciones y ausencias:**
- Solicitudes de vacaciones (fechas, motivo)
- Ausencias justificadas (tipo, fechas, documentación adjunta)
- Días de vacaciones acumulados, usados, disponibles
- Bajas médicas (solo fechas, no diagnóstico)

**Datos de gestión documental:**
- Documentos laborales (nóminas, contratos, etc.)
- Fecha de visualización y firma digital
- Estado de aceptación de documentos

**Datos de contacto de emergencia:**
- Nombre de contacto de emergencia
- Teléfono de contacto de emergencia

**Datos técnicos:**
- Dirección IP
- Logs de acceso y auditoría
- Navegador y dispositivo
- Tokens de sesión encriptados

---

## 3. LEGITIMACIÓN ESPECÍFICA POR TIPO DE DATO

### 3.1. Geolocalización en fichajes

**Base jurídica:** Consentimiento explícito del empleado (Art. 6.1.a RGPD)

**Información al empleado:**
- Se solicita consentimiento al primer fichaje mediante ventana modal
- El empleado puede denegar el consentimiento
- Si se deniega, el fichaje se registra sin coordenadas GPS
- El consentimiento puede revocarse desde la configuración de perfil
- Finalidad: Verificación de ubicación en fichajes (opcional)
- Datos: Latitud y longitud GPS con precisión de ~10 metros
- Conservación: Durante la relación laboral + 4 años (prescripción infracciones laborales)

**Implementación técnica:**
```javascript
// El sistema solicita consentimiento antes de acceder a geolocalización
if (!hasLocationConsent) {
  const consent = await requestLocationConsent();
  if (!consent) {
    // Fichaje se registra sin ubicación
    return null;
  }
}
```

### 3.2. Fotografía de perfil

**Base jurídica:** Consentimiento del empleado (opcional, no obligatorio)

**Información:**
- Totalmente opcional
- El empleado puede no subir foto y usar avatar con iniciales
- Puede eliminarse en cualquier momento
- Finalidad: Identificación visual en la aplicación
- Procesamiento: Redimensión automática a 200x200px, compresión

### 3.3. Firma digital

**Base jurídica:** Consentimiento del empleado

**Información:**
- Utilizada para firma de partes de trabajo y aceptación de documentos
- El empleado dibuja su firma con el dedo/ratón
- Se almacena como imagen PNG en base64
- Finalidad: Validación de partes de trabajo y documentos
- No tiene validez legal de firma electrónica cualificada

---

## 4. DESTINATARIOS Y TRANSFERENCIAS INTERNACIONALES

### 4.1. Destinatarios de los datos

**Proveedores de servicios (Encargados del Tratamiento):**

| Proveedor | Servicio | Ubicación | Garantías |
|-----------|----------|-----------|-----------|
| **Stripe** | Procesamiento de pagos | UE/USA | Cláusulas contractuales tipo UE, certificación PCI-DSS |
| **Railway.app** | Hosting de aplicación y base de datos | USA (servidores en UE disponibles) | Cláusulas contractuales tipo UE, ISO 27001 |
| **Cloudflare** | CDN, protección DDoS, DNS | Global (Edge en UE) | Cláusulas contractuales tipo UE |
| **Google Workspace** (si aplica) | Email corporativo | USA/UE | Cláusulas contractuales tipo UE, Privacy Shield |
| **Nodemailer/SMTP** | Envío de emails transaccionales | Variable según proveedor | Según proveedor SMTP |

**Transferencias internacionales:**
- Stripe: USA (cláusulas contractuales tipo aprobadas por la Comisión Europea)
- Railway.app: USA (posibilidad de hosting exclusivo en UE - configuración recomendada)
- Cloudflare: Global con edge computing en UE

**No se ceden datos a terceros con fines comerciales.**

### 4.2. Comunicaciones a autoridades

Los datos podrán comunicarse a:
- Autoridades fiscales (AEAT) - obligación legal
- Inspección de Trabajo - obligación legal
- Órganos judiciales - obligación legal por requerimiento
- Fuerzas y Cuerpos de Seguridad - obligación legal por requerimiento

---

## 5. PLAZO DE CONSERVACIÓN

| Tipo de dato | Plazo de conservación | Justificación |
|--------------|----------------------|---------------|
| **Datos de empresas clientes** | Durante contrato + 6 años | Normativa fiscal y contable |
| **Datos de empleados activos** | Durante relación laboral | Ejecución contrato |
| **Datos de empleados (histórico)** | 4 años desde baja | Prescripción infracciones laborales (Art. 60 ET) |
| **Registros de jornada (fichajes)** | 4 años | RD-ley 8/2019 (obligación legal) |
| **Documentos laborales** | Variable según normativa laboral | - Nóminas: 4 años<br>- Contratos: durante relación + 4 años<br>- Partes de trabajo: 5 años |
| **Logs de auditoría** | 2 años | Seguridad de la información |
| **Datos de pago (Stripe)** | Según política de Stripe | Gestión indirecta |
| **Backups** | 30 días | Recuperación ante desastres |

**Eliminación:**
- Los datos se eliminan automáticamente tras cumplirse el plazo de conservación
- Las empresas pueden solicitar eliminación anticipada (derecho de supresión)
- Los empleados pueden solicitar eliminación tras cesar su relación laboral (sujeto a obligaciones legales de la empresa)

---

## 6. DERECHOS DE LOS INTERESADOS

### 6.1. Derechos RGPD

Los interesados (empresas clientes y empleados) tienen derecho a:

**Acceso (Art. 15 RGPD):**
- Obtener confirmación de si se están tratando sus datos
- Acceder a sus datos personales
- Obtener copia de sus datos

**Rectificación (Art. 16 RGPD):**
- Corregir datos inexactos o incompletos

**Supresión / "Derecho al olvido" (Art. 17 RGPD):**
- Solicitar eliminación de datos (sujeto a obligaciones legales)

**Limitación del tratamiento (Art. 18 RGPD):**
- Solicitar bloqueo del tratamiento en determinadas circunstancias

**Oposición (Art. 21 RGPD):**
- Oponerse al tratamiento basado en interés legítimo
- Oposición absoluta a marketing

**Portabilidad (Art. 20 RGPD):**
- Recibir datos en formato estructurado y legible por máquina (JSON, CSV)
- Transmitir datos a otro responsable

**No ser objeto de decisiones automatizadas (Art. 22 RGPD):**
- Oficaz NO realiza decisiones automatizadas ni perfilado

**Retirada del consentimiento:**
- Para tratamientos basados en consentimiento (geolocalización, foto, marketing)

### 6.2. Ejercicio de derechos

**Para empleados:**
1. **Opción A (Recomendado):** Contactar con el departamento de RRHH de su empresa (Responsable del Tratamiento)
2. **Opción B:** Enviar email a info@oficaz.es con copia a su empresa

**Para empresas clientes:**
- Email: info@oficaz.es
- Formulario web: [URL del formulario]

**Requisitos:**
- Acreditar identidad (copia de DNI)
- Especificar derecho que se ejerce
- Indicar datos a los que se refiere (si no es la totalidad)

**Plazo de respuesta:** 1 mes (ampliable 2 meses más si es complejo)

### 6.3. Derecho a reclamar ante la AEPD

Si considera que el tratamiento no es conforme al RGPD, puede presentar reclamación ante:

**Agencia Española de Protección de Datos (AEPD)**  
C/ Jorge Juan, 6  
28001 Madrid  
Web: www.aepd.es  
Teléfono: 901 100 099 / 91 266 35 17

---

## 7. MEDIDAS DE SEGURIDAD

Oficaz implementa medidas técnicas y organizativas apropiadas para garantizar la seguridad de los datos:

### 7.1. Medidas técnicas

**Cifrado:**
- ✅ HTTPS/TLS 1.3 en todas las comunicaciones
- ✅ Contraseñas con bcrypt (factor 12)
- ✅ Tokens de sesión encriptados con algoritmo XOR + base64 (cliente)
- ✅ Refresh tokens hasheados en base de datos
- ✅ Tokens one-time para descargas seguras de documentos

**Control de acceso:**
- ✅ Autenticación JWT (15 minutos access token, 30 días refresh token)
- ✅ Sistema de roles (admin/manager/empleado)
- ✅ Rate limiting (protección contra ataques de fuerza bruta)
- ✅ Sesiones individuales por dispositivo

**Auditoría:**
- ✅ Logs de acceso (IP, acción, timestamp)
- ✅ Audit trail de modificaciones de fichajes (RD-ley 8/2019)
- ✅ Registro de quién, cuándo y qué modificó
- ✅ Monitorización de anomalías

**Protección de infraestructura:**
- ✅ Firewall (Cloudflare WAF)
- ✅ Protección DDoS
- ✅ Backups automáticos diarios (retención 30 días)
- ✅ Recuperación ante desastres (RTO < 4h, RPO < 24h)

**Aislamiento de datos:**
- ✅ Segregación por empresa (multi-tenant aislado)
- ✅ Cada empresa solo accede a sus datos
- ✅ Consultas con filtros obligatorios por companyId

### 7.2. Medidas organizativas

**Gestión de personal:**
- Formación en protección de datos para personal con acceso
- Cláusulas de confidencialidad en contratos
- Acceso limitado según principio de "necesidad de conocer"
- Procedimientos de alta/baja de accesos

**Procedimientos:**
- Procedimiento de gestión de brechas de seguridad
- Plan de continuidad de negocio
- Revisiones periódicas de seguridad
- Tests de penetración anuales

---

## 8. COOKIES Y TECNOLOGÍAS DE SEGUIMIENTO

**Política de cookies:** [Enlace a política de cookies detallada]

**Cookies utilizadas:**

| Cookie | Tipo | Finalidad | Caducidad |
|--------|------|-----------|-----------|
| `authData` | Necesaria | Sesión del usuario (encriptada) | Sesión o 30 días |
| `cookieConsent` | Necesaria | Guardar preferencias de cookies | 1 año |
| `locationConsent` | Necesaria | Consentimiento geolocalización | Permanente |
| `theme` | Funcional | Preferencia tema claro/oscuro | Permanente |
| Google Analytics | Analítica | Estadísticas de uso (opcional) | 2 años |

**Base legal:**
- Cookies necesarias: Exención art. 22.2 LSSI (estrictamente necesarias)
- Cookies analíticas/marketing: Consentimiento (banner de cookies)

**Gestión:**
- Los usuarios NO autenticados ven un banner de cookies
- Los usuarios autenticados están exentos (cookies necesarias para el servicio)
- Configuración accesible en cualquier momento

---

## 9. MODIFICACIONES DE LA POLÍTICA

Oficaz se reserva el derecho de modificar esta Política de Privacidad para adaptarla a:
- Cambios normativos
- Criterios de autoridades de control
- Cambios en los servicios ofrecidos

**Notificación de cambios:**
- Los cambios se publicarán en la web con 30 días de antelación
- Se notificará por email a empresas clientes
- La fecha de "última actualización" se actualizará

**Aceptación:**
- El uso continuado del servicio implica aceptación de los cambios
- Si no está de acuerdo, puede darse de baja del servicio

---

## 10. MENORES DE EDAD

Oficaz NO está dirigido a menores de 14 años.

**Política respecto a menores:**
- No se recopilan conscientemente datos de menores de 14 años
- Los empleados deben tener edad legal para trabajar (16 años en España, 18 con contrato laboral pleno)
- Si se detecta que se han recopilado datos de un menor, se eliminarán inmediatamente
- Los padres/tutores pueden solicitar eliminación de datos de menores

---

## 11. ENLACES A TERCEROS

Oficaz puede contener enlaces a sitios web de terceros (ej. Google Maps para ubicaciones).

**Responsabilidad:**
- Oficaz NO se hace responsable de las políticas de privacidad de terceros
- Se recomienda revisar las políticas de privacidad de los sitios enlazados
- Los enlaces se proporcionan por conveniencia, no implican aprobación

---

## 12. CONTACTO

Para cualquier consulta sobre esta Política de Privacidad o el tratamiento de datos:

**Email:** info@oficaz.es  
**Formulario web:** [URL]  
**Dirección postal:** [Completar]

**Para ejercicio de derechos RGPD:** Ver Sección 6.2

---

## 13. INFORMACIÓN PARA EMPLEADOS (RESUMEN)

Si eres empleado de una empresa cliente de Oficaz:

### Tu empresa es el Responsable del Tratamiento
- Tu empleador decide qué datos se tratan y con qué finalidad
- Oficaz solo procesa los datos siguiendo instrucciones de tu empresa
- Las consultas sobre tus derechos deben dirigirse primero a tu empresa

### Datos que se tratan sobre ti
- Identificación: nombre, DNI, email, teléfono, foto (opcional)
- Laborales: puesto, fecha alta, rol
- Control horario: fichajes con fecha/hora/ubicación (si consientes)
- Vacaciones: solicitudes, días disponibles
- Documentos: nóminas, contratos que te envíe tu empresa
- Comunicaciones: mensajes de tu empresa

### Tus derechos
- ✅ Acceder a tus datos
- ✅ Rectificar datos erróneos
- ✅ Solicitar eliminación (tras finalizar relación laboral)
- ✅ Oponerte a tratamientos (geolocalización, foto)
- ✅ Portabilidad de datos
- ✅ Reclamar ante la AEPD

### Consentimientos específicos
- **Geolocalización:** Se pide consentimiento explícito. Puedes denegar.
- **Foto de perfil:** Totalmente opcional. Puedes usar avatar.
- **Firma digital:** Para partes de trabajo, opcional.

### Contacto
- **Primero:** Habla con RRHH de tu empresa
- **Si no resuelven:** info@oficaz.es (con copia a tu empresa)

---

**Fecha de entrada en vigor:** 16 de enero de 2026

**Versión:** 1.0
