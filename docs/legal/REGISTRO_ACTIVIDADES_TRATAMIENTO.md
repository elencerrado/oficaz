# REGISTRO DE ACTIVIDADES DE TRATAMIENTO
## Artículo 30 RGPD - Oficaz Software de Gestión Laboral

**Última actualización:** 16 de enero de 2026  
**Versión:** 1.0  
**Responsable de mantenimiento:** José Ángel García Márquez (DNI: 09055639X)

---

## INTRODUCCIÓN

Conforme al **Artículo 30 del Reglamento (UE) 2016/679 (RGPD)**, toda entidad que trate datos personales debe mantener un registro de las actividades de tratamiento efectuadas bajo su responsabilidad.

**Oficaz** actúa en **doble rol**:

1. **Responsable del Tratamiento:** Para datos de empresas clientes (CIF, facturación, contacto)
2. **Encargado del Tratamiento:** Para datos de empleados de empresas clientes

Este documento registra ambos roles de forma separada.

---

## PARTE I: OFICAZ COMO RESPONSABLE DEL TRATAMIENTO

### ACTIVIDAD 1: GESTIÓN DE CLIENTES Y SUSCRIPCIONES

**1. Nombre y datos de contacto del responsable**

- **Denominación social:** Oficaz - Software de Gestión Laboral
- **NIF:** 09055639X
- **Dirección:** Avd. Clara Campoamor 4, Blq. 7 5º4 21920 San Juan de Aznalfarache (Sevilla)
- **Email:** soy@oficaz.es
- **Teléfono:** +34 614 028 600
- **Responsable:** José Ángel García Márquez
- **Delegado de Protección de Datos (DPO):** José Ángel García Márquez (funciones acumuladas)

**2. Fines del tratamiento**

- Gestión de clientes (empresas que contratan el servicio)
- Facturación y cobro de suscripciones
- Comunicaciones comerciales (nuevas funcionalidades, ofertas)
- Soporte técnico y atención al cliente
- Cumplimiento de obligaciones fiscales y contables
- Gestión de reclamaciones y litigios

**3. Descripción de las categorías de interesados**

- Empresas clientes (personas jurídicas)
- Representantes legales de empresas clientes (personas físicas)
- Contactos comerciales de empresas clientes
- Super-administradores de cuenta (personas físicas)

**4. Categorías de datos personales**

**Datos de identificación:**
- Nombre y apellidos del representante
- DNI/NIE del representante
- Email personal/corporativo
- Teléfono móvil y fijo

**Datos de la empresa:**
- Razón social
- CIF
- Dirección fiscal
- Sector de actividad

**Datos de facturación:**
- Método de pago (tarjeta tokenizada en Stripe)
- Historial de pagos
- Facturas emitidas
- Estado de suscripción

**Datos de uso:**
- Logs de acceso (IP, fecha/hora)
- Funcionalidades utilizadas
- Estadísticas de uso (número de empleados, fichajes, etc.)

**Datos de marketing:**
- Consentimiento para comunicaciones comerciales
- Preferencias de comunicación
- Historial de interacciones

**5. Categorías de destinatarios**

- **Stripe, Inc.:** Procesamiento de pagos (USA/UE, cláusulas contractuales tipo)
- **Railway.app:** Hosting de aplicación y BBDD (USA/UE, opción hosting exclusivo UE)
- **Cloudflare, Inc.:** CDN, seguridad, DNS (Global, edge en UE)
- **Asesoría fiscal/contable:** Gestión de facturación e impuestos (España)
- **Administración Tributaria (AEAT):** Obligación legal (España)
- **Juzgados y tribunales:** Requerimiento judicial (España)

**NO se ceden datos a terceros con fines comerciales.**

**6. Transferencias internacionales**

| Destinatario | País | Garantías |
|--------------|------|-----------|
| Stripe, Inc. | USA | Cláusulas Contractuales Tipo UE + Certificación PCI-DSS |
| Railway.app | USA | Cláusulas Contractuales Tipo UE + Opción hosting exclusivo UE |
| Cloudflare, Inc. | Global | Cláusulas Contractuales Tipo UE + Edge computing en UE |

**Minimización:** Se recomienda activar hosting exclusivo en UE (Railway.app) para evitar transferencias fuera del EEE.

**7. Plazos de supresión**

| Categoría de datos | Plazo de conservación | Base legal |
|--------------------|----------------------|-----------|
| Datos de contacto de cliente activo | Durante vigencia del contrato | Ejecución del contrato |
| Datos de cliente cancelado | 6 años tras cancelación | Obligación fiscal (Art. 30 Código de Comercio) |
| Facturas y datos de facturación | 6 años | Normativa fiscal (Art. 30 LGT) |
| Logs de acceso | 2 años | Seguridad de la información |
| Comunicaciones comerciales | Hasta revocación del consentimiento | Consentimiento |
| Backups | 30 días | Recuperación ante desastres |

**Eliminación automática:** Transcurridos los plazos, los datos se eliminan automáticamente.

**8. Descripción general de las medidas de seguridad**

- ✅ Cifrado TLS 1.3 en todas las comunicaciones (HTTPS obligatorio)
- ✅ Contraseñas hasheadas con bcrypt (factor 12)
- ✅ Autenticación basada en JWT (access token 15 min, refresh token 30 días)
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Backups automáticos diarios cifrados con AES-256
- ✅ Firewall de aplicaciones web (Cloudflare WAF)
- ✅ Protección anti-DDoS
- ✅ Auditoría de logs de acceso (IP, timestamp, acción)
- ✅ Formación del personal en protección de datos
- ✅ Cláusulas de confidencialidad en contratos de empleados
- ✅ Procedimiento de gestión de brechas de seguridad (notificación < 72h)

**Detalles completos en:** Anexo II del Contrato de Encargo de Tratamiento.

**9. Base jurídica del tratamiento**

- **Ejecución del contrato:** Gestión de clientes, facturación, prestación del servicio
- **Obligación legal:** Facturación, conservación fiscal (6 años)
- **Consentimiento:** Comunicaciones comerciales (revocable)
- **Interés legítimo:** Mejora del servicio, estadísticas de uso, soporte técnico

**10. Ejercicio de derechos**

Los interesados pueden ejercer sus derechos (acceso, rectificación, supresión, limitación, oposición, portabilidad) mediante:

- **Email:** info@oficaz.es
- **Formulario web:** www.oficaz.es/ejercicio-derechos (si existe)
- **Correo postal:** [Dirección de Oficaz]

**Plazo de respuesta:** 1 mes (prorrogable 2 meses adicionales en casos complejos)

**Acreditación de identidad:** Copia de DNI/NIE

---

### ACTIVIDAD 2: GESTIÓN DE PROVEEDORES Y COLABORADORES

**1. Nombre y datos de contacto del responsable**

- **Oficaz** (mismos datos que Actividad 1)

**2. Fines del tratamiento**

- Gestión de proveedores de servicios (desarrollo, hosting, seguridad)
- Pagos a proveedores
- Comunicaciones con colaboradores
- Cumplimiento de obligaciones fiscales (declaración de operaciones con terceros)

**3. Descripción de las categorías de interesados**

- Proveedores de tecnología (PaaS, SaaS)
- Desarrolladores freelance
- Asesores legales y fiscales
- Consultores de seguridad

**4. Categorías de datos personales**

- Nombre y apellidos (autónomos)
- DNI/NIE/CIF
- Email y teléfono
- Dirección fiscal
- Cuenta bancaria (para pagos)
- Datos de facturación

**5. Categorías de destinatarios**

- Asesoría fiscal/contable
- Administración Tributaria (AEAT) - Modelo 347
- Bancos (para transferencias)

**6. Transferencias internacionales**

**NO aplica** (proveedores principalmente en España/UE)

**7. Plazos de supresión**

- Durante relación comercial + 6 años (obligación fiscal)

**8. Medidas de seguridad**

Mismas que Actividad 1.

**9. Base jurídica**

- Ejecución del contrato
- Obligación legal (fiscal)

---

## PARTE II: OFICAZ COMO ENCARGADO DEL TRATAMIENTO

### ACTIVIDAD 3: TRATAMIENTO DE DATOS DE EMPLEADOS (POR CUENTA DE CLIENTES)

**1. Nombre y datos de contacto del encargado**

- **Oficaz** (mismos datos que Parte I)

**2. Nombre y datos de contacto del responsable (cliente)**

- **Variable:** Cada empresa cliente es un responsable del tratamiento diferente
- **Documentación:** Datos de cada responsable en Contrato de Encargo de Tratamiento individual

**3. Categorías de actividades de tratamiento efectuadas por cuenta del responsable**

#### 3.1. Control horario de empleados

**Finalidad (del responsable):**
- Cumplimiento del RD-ley 8/2019 (control horario obligatorio)
- Gestión de jornada laboral
- Cálculo de horas trabajadas
- Prevención de conflictos laborales

**Categorías de interesados:**
- Empleados activos del responsable
- Empleados de baja del responsable (histórico)

**Categorías de datos:**
- Nombre y apellidos
- DNI/NIE
- Fecha y hora de fichajes (entrada/salida)
- Duración de jornada
- Descansos (inicio y fin)
- Geolocalización GPS (solo si consentimiento explícito del empleado)
- Dispositivo usado (modelo de teléfono/PC)
- IP desde la que se ficha
- Modificaciones de fichajes (quién, cuándo, qué, por qué) - **Auditoría obligatoria**

**Operaciones de tratamiento:**
- Recogida (fichaje desde app móvil/web)
- Registro (almacenamiento en PostgreSQL)
- Consulta (panel de administración)
- Modificación (por administradores con auditoría)
- Extracción (informes, exportaciones)
- Conservación (4 años obligatorios)
- Supresión (tras 4 años desde baja)

**Destinatarios:**
- Administradores del responsable (acceso a panel)
- Inspección de Trabajo (requerimiento legal)
- Juzgados (procedimientos laborales)

**Transferencias internacionales:**
- Railway.app (USA/UE) - hosting de BBDD
- Stripe (USA/UE) - solo metadatos de suscripción, NO datos de empleados

**Plazos de conservación:**
- **Activos:** Durante relación laboral
- **Históricos:** 4 años desde baja del empleado (RD-ley 8/2019 + prescripción infracciones laborales)
- **Backups:** 30 días (ciclo automático)

**Medidas de seguridad específicas:**
- ✅ Segregación de datos por empresa (filtro obligatorio `companyId`)
- ✅ Auditoría completa de modificaciones de fichajes (inmutable)
- ✅ Validación de ownership en cada consulta
- ✅ Tokens de sesión con caducidad 15 minutos
- ✅ Cifrado de geolocalización en base de datos
- ✅ Backups cifrados AES-256

**Base jurídica del responsable:**
- Obligación legal (RD-ley 8/2019)

---

#### 3.2. Gestión de vacaciones y ausencias

**Finalidad (del responsable):**
- Gestión de solicitudes de vacaciones
- Control de ausencias (bajas, permisos)
- Planificación de recursos humanos
- Cumplimiento del Estatuto de los Trabajadores

**Categorías de interesados:**
- Empleados activos del responsable

**Categorías de datos:**
- Nombre y apellidos
- Tipo de ausencia (vacaciones, baja médica, permiso retribuido, asuntos propios)
- Fechas de inicio y fin
- Días solicitados/aprobados
- Estado de solicitud (pendiente/aprobada/rechazada)
- Comentarios del empleado (opcional)
- Documentación adjunta (solo en casos de baja médica u otros permisos)
  - **IMPORTANTE:** Solo se guardan fechas de baja, NO diagnósticos médicos

**Operaciones de tratamiento:**
- Recogida (formulario de solicitud)
- Registro (almacenamiento)
- Consulta (empleado y administradores)
- Modificación (aprobación/rechazo por managers)
- Cálculo (días disponibles, usados, pendientes)
- Supresión (tras finalización de relación + 4 años)

**Destinatarios:**
- Managers del responsable (aprobadores)
- Administradores RRHH
- Inspección de Trabajo (si procede)

**Transferencias internacionales:**
- Railway.app (USA/UE) - hosting BBDD

**Plazos de conservación:**
- Durante relación laboral + 4 años

**Medidas de seguridad específicas:**
- ✅ Acceso restringido (solo empleado y sus superiores)
- ✅ No se almacenan diagnósticos médicos
- ✅ Archivos adjuntos cifrados

**Base jurídica del responsable:**
- Ejecución del contrato de trabajo
- Obligación legal (Estatuto de los Trabajadores)

---

#### 3.3. Gestión documental laboral

**Finalidad (del responsable):**
- Distribución de nóminas a empleados
- Firma de contratos laborales
- Archivo de documentos laborales
- Firma de partes de trabajo
- Gestión de comunicaciones internas

**Categorías de interesados:**
- Empleados del responsable

**Categorías de datos:**
- Nombre y apellidos
- Tipo de documento (nómina, contrato, parte de trabajo, comunicado)
- Fecha de subida y de vista
- Firma digital (imagen PNG en base64)
- Fecha de firma/aceptación
- Contenido del documento (PDF/imagen)
- IP del firmante

**Operaciones de tratamiento:**
- Carga (por administradores)
- Almacenamiento (cifrado en servidor)
- Distribución (notificación a empleado)
- Descarga (por empleado mediante URL firmada de un solo uso)
- Firma (captura de firma en canvas)
- Auditoría (registro de descargas y firmas)
- Supresión (tras finalización + 4 años)

**Destinatarios:**
- Solo el empleado destinatario y administradores RRHH

**Transferencias internacionales:**
- Railway.app (USA/UE) - almacenamiento

**Plazos de conservación:**
- **Nóminas:** 4 años (prescripción fiscal)
- **Contratos:** Durante relación + 4 años
- **Partes de trabajo:** 4 años (prescripción laboral)
- **Comunicados:** Variable según tipo

**Medidas de seguridad específicas:**
- ✅ URLs de descarga firmadas y de un solo uso (caducidad 1 hora)
- ✅ Solo el empleado puede ver sus documentos
- ✅ Firma digital con timestamp y hash del documento
- ✅ Auditoría de todas las descargas (IP, fecha/hora)
- ✅ Archivos almacenados cifrados

**Base jurídica del responsable:**
- Ejecución del contrato laboral
- Obligación legal (conservación de nóminas, contratos)

---

#### 3.4. Comunicaciones internas (mensajes y notificaciones)

**Finalidad (del responsable):**
- Comunicaciones empresa-empleados
- Notificaciones de sistema (nuevos documentos, solicitudes)
- Recordatorios (tareas, eventos)
- Gestión de incidencias

**Categorías de interesados:**
- Empleados del responsable
- Administradores de la empresa

**Categorías de datos:**
- Nombre y apellidos del remitente/destinatario
- Asunto y contenido del mensaje
- Fecha y hora de envío
- Estado (leído/no leído)
- IP del remitente

**Operaciones de tratamiento:**
- Envío (desde panel de admin)
- Almacenamiento (PostgreSQL)
- Distribución (notificación push/email)
- Lectura (marcado como leído)
- Supresión (automática tras 6 meses o manual)

**Destinatarios:**
- Solo remitente y destinatario
- Administradores de la empresa (si procede)

**Transferencias internacionales:**
- Railway.app (USA/UE) - almacenamiento
- Proveedor SMTP - envío de emails (variable según configuración)

**Plazos de conservación:**
- **6 meses** (eliminación automática)
- Salvo que el responsable requiera conservación mayor por litigio

**Medidas de seguridad específicas:**
- ✅ Solo visible para remitente y destinatario
- ✅ No accesible por otros empleados
- ✅ Cifrado en tránsito (HTTPS/TLS)

**Base jurídica del responsable:**
- Interés legítimo (organización del trabajo)
- Ejecución del contrato

---

#### 3.5. Datos de perfil de empleados

**Finalidad (del responsable):**
- Identificación de empleados en la aplicación
- Gestión de contacto
- Gestión de emergencias

**Categorías de interesados:**
- Empleados del responsable

**Categorías de datos:**
- **Identificación:** Nombre, apellidos, DNI/NIE, foto de perfil (opcional)
- **Contacto:** Email personal, email corporativo, teléfono, dirección postal
- **Laborales:** Puesto de trabajo, fecha de alta en empresa, rol (admin/manager/empleado)
- **Emergencia:** Nombre y teléfono de contacto de emergencia
- **Técnicos:** Contraseña hasheada, tokens de sesión, última conexión

**Operaciones de tratamiento:**
- Registro (creación de cuenta por admin)
- Almacenamiento (PostgreSQL)
- Consulta (por el propio empleado y administradores)
- Modificación (por empleado o admin)
- Eliminación (baja del empleado)

**Destinatarios:**
- Otros empleados de la empresa (solo nombre y foto en listados)
- Administradores (datos completos)

**Transferencias internacionales:**
- Railway.app (USA/UE)

**Plazos de conservación:**
- Durante relación laboral + 4 años

**Medidas de seguridad específicas:**
- ✅ Contraseñas hasheadas bcrypt (nunca en texto plano)
- ✅ Foto de perfil totalmente opcional (avatar por defecto)
- ✅ Contacto de emergencia solo visible para administradores
- ✅ Email y teléfono no visibles para otros empleados salvo autorización

**Base jurídica del responsable:**
- Ejecución del contrato laboral
- Interés legítimo (emergencias)
- Consentimiento (foto de perfil)

---

## RESUMEN DE TRATAMIENTOS

### Tabla resumen - Oficaz como RESPONSABLE

| Actividad | Categoría de datos | Base jurídica | Conservación |
|-----------|--------------------|---------------|--------------|
| Gestión clientes | Empresa + contacto + facturación | Ejecución contrato + obligación legal | Durante contrato + 6 años |
| Marketing | Email, consentimiento | Consentimiento | Hasta revocación |
| Proveedores | Datos de contacto + facturación | Ejecución contrato + obligación legal | Durante relación + 6 años |

---

### Tabla resumen - Oficaz como ENCARGADO (por cuenta de clientes)

| Actividad | Categoría de datos | Base jurídica (del responsable) | Conservación |
|-----------|--------------------|---------------------------------|--------------|
| Control horario | Fichajes + geolocalización + auditoría | Obligación legal (RD-ley 8/2019) | Durante relación + 4 años |
| Vacaciones | Solicitudes + ausencias | Ejecución contrato + obligación legal | Durante relación + 4 años |
| Documentos | Nóminas + contratos + firmas | Ejecución contrato + obligación legal | Variable según tipo (4 años) |
| Mensajería | Comunicaciones internas | Interés legítimo | 6 meses |
| Perfil empleado | Identificación + contacto | Ejecución contrato + consentimiento (foto) | Durante relación + 4 años |

---

## ACTUALIZACIÓN DEL REGISTRO

**Frecuencia de revisión:** Semestral (cada 6 meses)

**Responsable de actualización:** [Nombre del DPO o responsable legal]

**Última revisión:** 16 de enero de 2026

**Próxima revisión:** 16 de julio de 2026

**Cambios a registrar:**
- Nuevas finalidades de tratamiento
- Nuevos subencargados o destinatarios
- Cambios en medidas de seguridad
- Cambios en plazos de conservación
- Nuevas categorías de datos

---

## CONSERVACIÓN DEL REGISTRO

Este registro se conservará:

- ✅ En formato digital: Repositorio Git (acceso restringido)
- ✅ Copia impresa: Archivador legal de la empresa
- ✅ Disponible para AEPD: En caso de inspección

**Acceso:**
- Responsable legal / DPO
- Dirección / CEO
- AEPD (inspección)

---

## DECLARACIÓN DE CONFORMIDAD

Declaramos que el presente Registro de Actividades de Tratamiento cumple con los requisitos del **Artículo 30 del RGPD** y refleja fielmente las actividades de tratamiento de datos personales de Oficaz.

**Firma:**

___________________________  
[Nombre del responsable legal]  
[Cargo]  
[Fecha]

---

**FIN DEL REGISTRO**

**Versión:** 1.0  
**Fecha:** 16 de enero de 2026
