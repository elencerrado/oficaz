# CONTRATO DE ENCARGO DE TRATAMIENTO DE DATOS (DPA)
## Data Processing Agreement - RGPD/GDPR Compliant

**Entre:**

**RESPONSABLE DEL TRATAMIENTO (Cliente)**  
Empresa: [NOMBRE DE LA EMPRESA CLIENTE]  
CIF: [CIF DE LA EMPRESA]  
Domicilio: [DIRECCIÓN]  
Representante: [NOMBRE Y CARGO]

**Y**

**ENCARGADO DEL TRATAMIENTO (Oficaz)**  
Empresa: Oficaz - Software de Gestión Laboral  
NIF: 09055639X  
Domicilio: Avd. Clara Campoamor 4, Blq. 7 5º4 21920 San Juan de Aznalfarache (Sevilla)  
Representante: José Ángel García Márquez  
Cargo: Responsable Único / Representante Legal  
Email: soy@oficaz.es  
Teléfono: +34 614 028 600

---

## ANTECEDENTES

**I.** El RESPONSABLE es una empresa que precisa gestionar datos de sus empleados para cumplir con sus obligaciones laborales, incluyendo el control horario obligatorio según RD-ley 8/2019.

**II.** El ENCARGADO presta servicios de software como servicio (SaaS) de gestión laboral y control horario bajo la marca "Oficaz".

**III.** En virtud de la prestación de estos servicios, el ENCARGADO tendrá acceso a datos personales de empleados del RESPONSABLE, actuando como Encargado del Tratamiento en los términos del Artículo 28 del Reglamento (UE) 2016/679 (RGPD).

**IV.** Ambas partes desean formalizar las condiciones del encargo de tratamiento conforme a la normativa de protección de datos.

---

## CLÁUSULAS

### CLÁUSULA 1. OBJETO Y DURACIÓN

**1.1. Objeto**

El presente contrato tiene por objeto establecer las condiciones conforme a las cuales el ENCARGADO tratará, por cuenta del RESPONSABLE, datos personales de empleados y otras personas relacionadas con la actividad laboral del RESPONSABLE.

**1.2. Servicios incluidos**

El ENCARGADO prestará los siguientes servicios que implican tratamiento de datos personales:

- **Gestión de control horario:** Registro de fichajes de entrada/salida, descansos, con geolocalización opcional
- **Gestión de vacaciones y ausencias:** Solicitudes, aprobaciones, cálculo de días disponibles
- **Gestión documental:** Almacenamiento seguro de documentos laborales (nóminas, contratos, etc.)
- **Comunicaciones internas:** Sistema de mensajería empresa-empleados
- **Firma digital:** Herramienta de firma de documentos y partes de trabajo
- **Recordatorios:** Sistema de recordatorios y notificaciones
- **Auditoría:** Logs de auditoría de modificaciones de fichajes (RD-ley 8/2019)
- **Reporting:** Informes de jornada laboral y estadísticas
- **Almacenamiento de fotos de perfil:** Opcional, por consentimiento del empleado

**1.3. Duración**

El contrato estará vigente mientras esté activa la suscripción del RESPONSABLE al servicio Oficaz, y se extenderá durante el plazo de conservación de datos establecido en el Anexo I.

**1.4. Finalización**

A la finalización del contrato, el ENCARGADO procederá conforme a la Cláusula 9 (Destino de los datos).

---

### CLÁUSULA 2. IDENTIFICACIÓN DE LA INFORMACIÓN AFECTADA

**2.1. Tipos de interesados**

Los interesados cuyos datos personales serán tratados son:

- Empleados activos del RESPONSABLE
- Empleados de baja del RESPONSABLE (histórico conservado según normativa)
- Administradores y managers de la empresa
- Contactos de emergencia de empleados (nombre y teléfono)
- Contacto principal de la empresa (datos del administrador principal)

**2.2. Categorías de datos personales**

Ver **Anexo I - Descripción detallada de los tratamientos**.

**2.3. Datos de categorías especiales**

El ENCARGADO **NO** tratará datos de categorías especiales del art. 9 RGPD (origen étnico/racial, opiniones políticas, convicciones religiosas, afiliación sindical, datos genéticos, biométricos, salud, vida sexual/orientación sexual), **SALVO:**

- **Bajas médicas:** Solo fechas de ausencia por incapacidad temporal, SIN acceso al diagnóstico ni información médica
- **Geolocalización:** Con consentimiento explícito del empleado (ver Cláusula 3.5)

**En caso de bajas médicas:**
- El RESPONSABLE solo cargará fechas de inicio y fin de baja
- NO se subirá el parte médico ni información sanitaria
- El tipo de ausencia se marca como "Incapacidad Temporal" sin detalles

---

### CLÁUSULA 3. OBLIGACIONES DEL ENCARGADO

**3.1. Tratamiento conforme a instrucciones**

El ENCARGADO se compromete a:

a) Tratar los datos únicamente según las instrucciones documentadas del RESPONSABLE, que se concretan en:
   - Las finalidades descritas en el Anexo I
   - Las funcionalidades del software Oficaz contratadas
   - Las instrucciones escritas adicionales que el RESPONSABLE pueda comunicar

b) Informar inmediatamente al RESPONSABLE si, en su opinión, una instrucción infringe el RGPD u otra normativa de protección de datos.

c) No aplicar los datos a finalidades distintas de las pactadas.

d) No comunicar los datos a terceras personas, salvo subencargados autorizados (Cláusula 4) o por obligación legal.

**3.2. Deber de confidencialidad**

El ENCARGADO garantiza que:

a) Las personas autorizadas para tratar datos personales se han comprometido a respetar la confidencialidad o están sujetas a una obligación legal de confidencialidad.

b) Ha proporcionado formación adecuada en materia de protección de datos a su personal.

c) El acceso a los datos está limitado al personal estrictamente necesario.

**3.3. Medidas de seguridad**

El ENCARGADO implementará medidas técnicas y organizativas apropiadas para garantizar un nivel de seguridad adecuado al riesgo, incluyendo:

**Medidas técnicas:**
- ✅ Cifrado de comunicaciones (HTTPS/TLS 1.3)
- ✅ Cifrado de contraseñas (bcrypt factor 12)
- ✅ Cifrado de tokens de sesión
- ✅ Autenticación multifactor disponible (recomendado para admins)
- ✅ Backups cifrados automáticos diarios
- ✅ Firewall de aplicaciones web (WAF)
- ✅ Protección anti-DDoS
- ✅ Certificados SSL/TLS de grado A+
- ✅ Segregación de datos por empresa (multi-tenant aislado)
- ✅ Sistema de auditoría con trazabilidad completa

**Medidas organizativas:**
- ✅ Política de control de accesos
- ✅ Procedimiento de gestión de brechas de seguridad (< 72h notificación)
- ✅ Auditorías de seguridad periódicas
- ✅ Formación continua del personal en protección de datos
- ✅ Cláusulas de confidencialidad en contratos de empleados

**Detalles técnicos en Anexo II - Medidas de Seguridad.**

**3.4. Asistencia al RESPONSABLE**

El ENCARGADO, teniendo en cuenta la naturaleza del tratamiento, ayudará al RESPONSABLE mediante medidas técnicas y organizativas apropiadas, siempre que sea posible, para que este pueda cumplir con su obligación de:

a) **Responder a solicitudes de ejercicio de derechos** de los interesados (acceso, rectificación, supresión, limitación, oposición, portabilidad).

b) **Realizar evaluaciones de impacto** de protección de datos (EIPD) cuando proceda.

c) **Consultar previamente** a la autoridad de control cuando proceda.

d) **Garantizar la seguridad** del tratamiento.

e) **Notificar violaciones de seguridad** de datos personales.

**Modalidades de asistencia:**

- **Soporte técnico:** Email info@oficaz.es (respuesta en 24-48h laborables)
- **Exportación de datos:** Funcionalidad self-service en panel de administración (formato JSON, CSV, Excel)
- **Búsqueda de datos de un empleado:** Funcionalidad en panel de admin
- **Eliminación de datos:** Funcionalidad de baja de empleado + eliminación de empresa
- **Logs de auditoría:** Disponibles en panel de administración
- **Informes de actividad:** Generación de informes desde panel

**Sin coste adicional para solicitudes razonables. Solicitudes extraordinarias podrán facturarse según tarifa vigente.**

**3.5. Gestión de consentimientos (geolocalización y fotos)**

El ENCARGADO implementa sistemas técnicos para:

a) **Geolocalización:**
   - Solicitar consentimiento explícito al empleado antes del primer fichaje con ubicación
   - Guardar la decisión del empleado (aceptar/denegar)
   - Permitir fichaje sin ubicación si se deniega el consentimiento
   - No bloquear el uso de la aplicación si se deniega
   - Permitir revocación del consentimiento desde perfil de empleado

b) **Fotos de perfil:**
   - Totalmente opcional
   - Sistema funciona con avatars (iniciales) si no hay foto
   - Empleado puede subir y eliminar su foto en cualquier momento
   - No se solicitan fotos de forma obligatoria

**IMPORTANTE:** Es responsabilidad del RESPONSABLE informar adecuadamente a sus empleados sobre estos tratamientos según modelo de Cláusula Informativa (Anexo III).

**3.6. Notificación de violaciones de seguridad**

En caso de violación de la seguridad de los datos personales, el ENCARGADO se compromete a:

a) **Notificar al RESPONSABLE sin dilación indebida** y, a ser posible, **en un plazo máximo de 24 horas** tras tener conocimiento de la violación.

b) Proporcionar la siguiente información:
   - Descripción de la naturaleza de la violación
   - Categorías y número aproximado de interesados afectados
   - Categorías y número aproximado de registros de datos afectados
   - Nombre y datos de contacto del punto de contacto (DPO si procede)
   - Descripción de las posibles consecuencias
   - Descripción de las medidas adoptadas o propuestas para remediar la violación y mitigar sus posibles efectos adversos

c) **Documentar la violación**, incluyendo hechos, efectos y medidas correctivas.

d) **Cooperar** con el RESPONSABLE en la investigación y respuesta a la violación.

e) **Asistir** al RESPONSABLE para que este pueda cumplir con su obligación de notificación a la autoridad de control (AEPD) en 72 horas y, en su caso, a los interesados.

**Procedimiento de notificación:**
- **Email urgente:** info@oficaz.es con asunto "URGENTE - VIOLACIÓN SEGURIDAD DATOS"
- **Teléfono:** [Número de emergencia 24/7]

**Tipos de violaciones cubiertas:**
- Acceso no autorizado a datos
- Pérdida de datos
- Modificación no autorizada
- Destrucción accidental de datos
- Brechas de seguridad en infraestructura
- Ransomware u otros ataques

---

### CLÁUSULA 4. SUBENCARGADOS

**4.1. Autorización general**

El RESPONSABLE autoriza al ENCARGADO a contratar **subencargados del tratamiento** para la prestación del servicio, siempre que:

a) El ENCARGADO informe previamente al RESPONSABLE de cualquier cambio previsto en la incorporación o sustitución de subencargados.

b) El RESPONSABLE disponga de un **plazo de 15 días naturales** para oponerse por causa justificada.

c) El ENCARGADO suscriba con el subencargado un **contrato** que imponga las mismas obligaciones de protección de datos que las establecidas en este contrato.

**4.2. Subencargados actuales autorizados**

El RESPONSABLE autoriza expresamente a los siguientes subencargados:

| Subencargado | Servicio | Ubicación | Medidas de seguridad |
|--------------|----------|-----------|----------------------|
| **Stripe, Inc.** | Procesamiento de pagos de suscripciones | USA/UE | - Cláusulas Contractuales Tipo UE<br>- Certificación PCI-DSS nivel 1<br>- ISO 27001<br>- SOC 2 Tipo II<br>- Cifrado end-to-end |
| **Railway.app** (PaaS) | Hosting de aplicación y base de datos PostgreSQL | USA (servidores UE disponibles) | - Cláusulas Contractuales Tipo UE<br>- ISO 27001<br>- Cifrado en reposo (AES-256)<br>- Backups automáticos<br>- Segregación de tenants |
| **Cloudflare, Inc.** | CDN, protección DDoS, DNS, firewall | Global (edge en UE) | - Cláusulas Contractuales Tipo UE<br>- ISO 27001<br>- SOC 2 Tipo II<br>- Cifrado TLS 1.3 |
| **Proveedor SMTP** (variable) | Envío de emails transaccionales (activaciones, recuperación contraseña) | Variable | Según proveedor elegido por el cliente |

**4.3. Transferencias internacionales**

Algunos subencargados están ubicados fuera del Espacio Económico Europeo (EEE):

- **Stripe:** USA - Garantías: Cláusulas Contractuales Tipo aprobadas por Comisión Europea
- **Railway.app:** USA - Garantías: Cláusulas Contractuales Tipo + opción de hosting exclusivo en UE (recomendado)
- **Cloudflare:** Global - Garantías: Edge computing en UE, cláusulas contractuales tipo

**Minimización de transferencias:**
- Se recomienda activar hosting en UE (Railway.app) para máxima privacidad
- Los datos solo salen de UE cuando es estrictamente necesario para el servicio
- Todos los subencargados cumplen RGPD/GDPR

**4.4. Responsabilidad**

El ENCARGADO será plenamente responsable ante el RESPONSABLE del cumplimiento por parte de los subencargados de sus obligaciones en materia de protección de datos.

**4.5. Lista actualizada**

El ENCARGADO mantendrá una lista actualizada de subencargados en:
- Panel de administración de Oficaz (sección Legal)
- Sitio web público: www.oficaz.es/subencargados

---

### CLÁUSULA 5. EJERCICIO DE DERECHOS

**5.1. Procedimiento**

Cuando un empleado (interesado) ejerza sus derechos RGPD:

**Opción A - Directamente al RESPONSABLE (recomendado):**
1. El empleado contacta con RRHH de su empresa
2. El RESPONSABLE usa las funcionalidades de Oficaz para atender la solicitud
3. Si necesita asistencia técnica, contacta con info@oficaz.es

**Opción B - A través del ENCARGADO:**
1. El empleado envía solicitud a info@oficaz.es (con copia a su empresa)
2. El ENCARGADO remite la solicitud al RESPONSABLE en **máximo 48h**
3. El RESPONSABLE decide y comunica su decisión
4. El ENCARGADO ejecuta las instrucciones del RESPONSABLE

**5.2. Herramientas para ejercicio de derechos**

El ENCARGADO pone a disposición del RESPONSABLE las siguientes herramientas:

| Derecho | Herramienta en Oficaz |
|---------|----------------------|
| **Acceso** | Exportación de datos del empleado (JSON, CSV, Excel) |
| **Rectificación** | Edición de datos desde panel de admin |
| **Supresión** | Botón "Dar de baja empleado" + "Eliminar histórico" (con confirmación) |
| **Limitación** | Marcar empleado como "Inactivo" (bloquea acceso, conserva datos) |
| **Oposición** | Desactivar geolocalización, eliminar foto de perfil |
| **Portabilidad** | Exportación en formatos interoperables (JSON, CSV) |

**5.3. Plazos**

- **Remisión de solicitud al RESPONSABLE:** 48 horas
- **Asistencia técnica para exportación:** 48-72 horas laborables
- **Eliminación de datos tras instrucción:** 7 días

**5.4. Sin coste adicional**

El ejercicio de derechos no tendrá coste adicional para el RESPONSABLE, salvo solicitudes manifiestamente infundadas o excesivas.

---

### CLÁUSULA 6. CONSERVACIÓN Y ELIMINACIÓN DE DATOS

**6.1. Plazos de conservación**

Los datos se conservarán durante:

| Tipo de dato | Plazo | Base legal |
|--------------|-------|-----------|
| Datos de empleados activos | Durante relación laboral | Ejecución contrato |
| Histórico de empleados de baja | 4 años desde baja | Prescripción infracciones laborales (Art. 60 ET) |
| Registros de jornada (fichajes) | 4 años | RD-ley 8/2019 (obligación legal) |
| Documentos laborales | Variable según tipo | Normativa laboral |
| Logs de auditoría | 2 años | Seguridad de la información |
| Backups | 30 días | Recuperación ante desastres |

**6.2. Eliminación automática**

Transcurridos los plazos de conservación, el ENCARGADO procederá a la **eliminación automática** de los datos, salvo que:

a) El RESPONSABLE requiera expresamente su conservación por obligaciones legales adicionales
b) Exista un procedimiento judicial, administrativo o arbitral en curso

**6.3. Eliminación manual**

El RESPONSABLE puede solicitar en cualquier momento la eliminación anticipada de datos mediante:

- Funcionalidad "Eliminar empresa" en panel de administración (con todas las garantías)
- Solicitud expresa por email a info@oficaz.es

**Plazo de ejecución:** 15 días naturales

---

### CLÁUSULA 7. AUDITORÍA Y CUMPLIMIENTO

**7.1. Derecho de auditoría**

El RESPONSABLE tiene derecho a auditar el cumplimiento por parte del ENCARGADO de sus obligaciones en materia de protección de datos.

**Modalidades:**

a) **Auditorías documentales:** Revisión de políticas, procedimientos, certificaciones.
   - Frecuencia: Anual
   - Sin coste adicional

b) **Auditorías sobre certificaciones externas:** El ENCARGADO proporcionará:
   - Certificados ISO 27001 (si aplica)
   - Informes SOC 2 de subencargados (Stripe, Railway, Cloudflare)
   - Informes de pentesting anuales (resumen ejecutivo)

c) **Auditorías in situ:** Visitas a las instalaciones del ENCARGADO.
   - Frecuencia: Máximo 1 vez al año
   - Previo aviso de 30 días
   - Coste: A cargo del RESPONSABLE si no hay incumplimiento

**7.2. Información a proporcionar**

El ENCARGADO pondrá a disposición del RESPONSABLE toda la información necesaria para demostrar el cumplimiento de sus obligaciones, incluyendo:

- Política de seguridad de la información
- Procedimiento de gestión de brechas
- Registro de violaciones de seguridad (si las hubiera)
- Contratos con subencargados
- Formación del personal en protección de datos
- Logs de auditoría (muestras anonimizadas)

**7.3. Derecho de inspección de autoridades**

El ENCARGADO cooperará con la AEPD (Agencia Española de Protección de Datos) o autoridades de control competentes en sus funciones de inspección.

---

### CLÁUSULA 8. RESPONSABILIDAD E INDEMNIZACIÓN

**8.1. Responsabilidad del ENCARGADO**

El ENCARGADO será responsable de los daños y perjuicios que cause al RESPONSABLE o a los interesados por:

a) Incumplimiento de las obligaciones del RGPD aplicables específicamente a encargados del tratamiento.
b) Actuación al margen o contraria a las instrucciones legítimas del RESPONSABLE.
c) Violaciones de seguridad imputables a negligencia grave del ENCARGADO.

**8.2. Exención de responsabilidad**

El ENCARGADO quedará exento de responsabilidad si demuestra que no es en modo alguno responsable del hecho que haya causado los daños o que actuó conforme a las instrucciones del RESPONSABLE.

**8.3. Limitación de responsabilidad**

La responsabilidad del ENCARGADO queda limitada a:

- **Daños directos:** Hasta el importe de la suscripción anual del RESPONSABLE
- **Daños indirectos:** Excluidos salvo dolo o negligencia grave

**Excepciones a la limitación:**
- Violaciones de seguridad por negligencia grave o dolo
- Incumplimiento de confidencialidad
- Uso de datos para fines propios

**8.4. Seguro de responsabilidad civil**

El ENCARGADO declara contar con seguro de responsabilidad civil profesional que cubre daños derivados del tratamiento de datos personales.

---

### CLÁUSULA 9. DESTINO DE LOS DATOS TRAS FINALIZACIÓN

**9.1. Opciones**

A la finalización del contrato (cancelación de suscripción o eliminación de cuenta), el RESPONSABLE podrá optar entre:

**Opción A - Exportación y eliminación:**
1. El RESPONSABLE exporta todos sus datos en formato JSON/CSV/Excel
2. El ENCARGADO elimina todos los datos en un plazo máximo de 30 días
3. Se proporciona certificado de eliminación

**Opción B - Eliminación directa:**
1. El RESPONSABLE solicita eliminación inmediata
2. El ENCARGADO elimina todos los datos en un plazo máximo de 15 días
3. Se proporciona certificado de eliminación

**9.2. Eliminación completa**

La eliminación incluirá:

- ✅ Todos los datos de empleados (activos e históricos)
- ✅ Todos los fichajes y registros de jornada
- ✅ Todos los documentos (nóminas, contratos, etc.)
- ✅ Todas las comunicaciones y mensajes
- ✅ Todos los backups (en máximo 30 días, según ciclo de backup)
- ✅ Todos los logs de auditoría relacionados
- ✅ Fotos de perfil y firmas digitales

**Excepciones (conservación legal obligatoria):**

- Datos de facturación del RESPONSABLE: 6 años (normativa fiscal)
- Logs de seguridad relacionados con incidentes investigados: 2 años
- Datos requeridos por autoridad judicial: Según requerimiento

**9.3. Certificado de eliminación**

El ENCARGADO proporcionará un **certificado de eliminación** en formato PDF firmado digitalmente que acredite:

- Fecha de eliminación
- Tipos de datos eliminados
- Número aproximado de registros eliminados
- Confirmación de eliminación de backups
- Firma del responsable técnico

**9.4. Periodo de gracia**

Tras cancelación de suscripción, el RESPONSABLE dispone de **30 días** para exportar sus datos antes de que el ENCARGADO proceda a la eliminación automática.

Durante este periodo:
- Los datos quedan bloqueados (solo lectura)
- No se pueden añadir nuevos datos
- Se puede acceder solo para exportación

---

### CLÁUSULA 10. RETRIBUCIÓN

**10.1. Sin coste adicional**

Los servicios de Encargado del Tratamiento descritos en este contrato están incluidos en el precio de la suscripción al servicio Oficaz, sin coste adicional.

**10.2. Servicios extraordinarios**

Los siguientes servicios extraordinarios podrán facturarse según tarifa vigente:

- Auditorías in situ solicitadas por el RESPONSABLE (si no hay incumplimiento)
- Exportaciones de datos extraordinarias (más de 1 vez al mes)
- Asistencia técnica intensiva para ejercicio de derechos complejos (>4 horas)
- Desarrollos a medida para cumplimiento de requisitos específicos del RESPONSABLE

**Tarifa:** Según tarifa de servicios profesionales vigente (disponible en www.oficaz.es/tarifas)

---

### CLÁUSULA 11. LEGISLACIÓN Y JURISDICCIÓN

**11.1. Legislación aplicable**

Este contrato se rige por:

- Reglamento (UE) 2016/679 (RGPD)
- Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD)
- Real Decreto-ley 8/2019 (Control Horario Obligatorio)
- Estatuto de los Trabajadores
- Legislación española en materia de protección de datos y laboral

**11.2. Jurisdicción**

Para cualquier controversia derivada del presente contrato, las partes se someten a los Juzgados y Tribunales de [CIUDAD], renunciando expresamente a cualquier otro fuero que pudiera corresponderles.

**11.3. Resolución de conflictos**

Antes de acudir a la vía judicial, las partes intentarán resolver cualquier controversia mediante:

1. **Negociación directa:** 15 días
2. **Mediación:** 30 días adicionales

Si persiste el conflicto, se acudirá a la vía judicial.

---

### CLÁUSULA 12. MODIFICACIONES

**12.1. Modificaciones por cambios legales**

El ENCARGADO podrá modificar este contrato para adaptarlo a:

- Cambios en el RGPD o normativa de protección de datos
- Criterios de la AEPD o autoridades de control
- Sentencias del TJUE o tribunales nacionales

**Notificación:** Con 30 días de antelación por email

**12.2. Modificaciones por cambios tecnológicos**

Las modificaciones en subencargados, medidas de seguridad o procedimientos se comunicarán con 15 días de antelación.

**12.3. Derecho de oposición**

El RESPONSABLE puede oponerse a las modificaciones y resolver el contrato en un plazo de 15 días desde la notificación, sin penalización.

---

### CLÁUSULA 13. COMUNICACIONES

**13.1. Notificaciones**

Todas las comunicaciones relacionadas con este contrato se realizarán por escrito a:

**RESPONSABLE:**  
Email: [Email del cliente]  
Atención: [Nombre del responsable]

**ENCARGADO:**  
Email: info@oficaz.es  
Atención: Departamento Legal

**13.2. Urgencias**

Para violaciones de seguridad o incidentes críticos:

- Email: security@oficaz.es (si está disponible, sino info@oficaz.es)
- Asunto: "URGENTE - [NOMBRE DEL ASUNTO]"
- Teléfono 24/7: [Número de emergencia]

---

## ANEXO I - DESCRIPCIÓN DE LOS TRATAMIENTOS

### 1. FINALIDADES DEL TRATAMIENTO

| Finalidad | Descripción | Base jurídica (del RESPONSABLE) |
|-----------|-------------|--------------------------------|
| **Control horario** | Registro de fichajes de entrada/salida, descansos, jornada laboral | Obligación legal (RD-ley 8/2019) |
| **Gestión de vacaciones** | Solicitudes, aprobaciones, cálculo de días | Ejecución contrato laboral |
| **Gestión documental** | Almacenamiento y distribución de nóminas, contratos, etc. | Ejecución contrato laboral |
| **Comunicaciones internas** | Mensajes empresa-empleados | Interés legítimo (organización trabajo) |
| **Firma digital** | Firma de partes de trabajo y documentos | Consentimiento + interés legítimo |
| **Auditoría** | Trazabilidad de modificaciones de fichajes | Obligación legal (RD-ley 8/2019) |
| **Geolocalización** | Ubicación GPS al fichar (opcional) | **Consentimiento explícito del empleado** |
| **Fotos de perfil** | Avatar visual en aplicación (opcional) | **Consentimiento del empleado** |

### 2. CATEGORÍAS DE DATOS PERSONALES TRATADOS

**Datos de identificación:**
- Nombre y apellidos
- DNI/NIE
- Fotografía (opcional)

**Datos de contacto:**
- Email personal
- Email corporativo
- Teléfono personal
- Teléfono corporativo
- Dirección postal

**Datos laborales:**
- Puesto de trabajo
- Fecha de alta en empresa
- Rol (admin/manager/empleado)
- Estado laboral (activo/inactivo/baja/vacaciones)
- Salario (NO - las nóminas se suben como PDFs, Oficaz no procesa cifras salariales)

**Datos de jornada laboral:**
- Fecha y hora de fichajes entrada/salida
- Duración de jornada
- Descansos (inicio y fin)
- Geolocalización GPS (si consentimiento concedido)
- Dispositivo usado para fichar
- Modificaciones de fichajes (quién, cuándo, motivo)

**Datos de vacaciones y ausencias:**
- Solicitudes de vacaciones (fechas, motivo opcional)
- Tipo de ausencia (vacaciones, baja médica, permiso)
- Días acumulados, usados, disponibles
- Documentación justificativa (archivos PDF)

**Datos de documentos:**
- Tipo de documento (nómina, contrato, etc.)
- Fecha de subida
- Estado (visto/no visto, firmado/no firmado)
- Firma digital (imagen PNG en base64)

**Datos de contacto de emergencia:**
- Nombre de persona de contacto
- Teléfono de persona de contacto

**Datos técnicos:**
- Dirección IP
- Navegador y sistema operativo
- Logs de acceso (timestamp, acción, IP)
- Tokens de sesión (encriptados)

### 3. NÚMERO APROXIMADO DE INTERESADOS

Variable según tamaño de la empresa cliente:

- **Pequeñas empresas:** 1-10 empleados
- **Empresas medianas:** 11-50 empleados
- **Empresas grandes:** 51+ empleados

**Total estimado en plataforma Oficaz:** [Actualizar según crecimiento]

### 4. OPERACIONES DE TRATAMIENTO

- **Recogida:** A través de formularios web (panel de administración)
- **Registro:** Almacenamiento en base de datos PostgreSQL
- **Organización:** Estructuración en tablas relacionales
- **Estructuración:** Indexación para búsquedas eficientes
- **Conservación:** Almacenamiento seguro con backups automáticos
- **Modificación:** Edición por administradores con auditoría completa
- **Extracción:** Consultas SQL con filtros por empresa (aislamiento multi-tenant)
- **Consulta:** Panel de administración, APIs REST autenticadas
- **Comunicación:** Notificaciones push, emails transaccionales
- **Cotejo:** Cruce de datos para cálculo de horas, vacaciones
- **Limitación:** Bloqueo de acceso sin eliminación (empleados inactivos)
- **Supresión:** Eliminación física en base de datos + backups
- **Destrucción:** Eliminación segura de archivos (fotos, documentos)

---

## ANEXO II - MEDIDAS DE SEGURIDAD

### 1. MEDIDAS TÉCNICAS

#### 1.1. Control de acceso

**Autenticación:**
- ✅ Sistema JWT con access tokens de 15 minutos
- ✅ Refresh tokens de 30 días (rotación automática)
- ✅ Contraseñas hasheadas con bcrypt (factor 12)
- ✅ Bloqueo de cuenta tras 5 intentos fallidos (15 minutos)
- ✅ Tokens de sesión encriptados en cliente (XOR + base64)

**Autorización:**
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Segregación de datos por empresa (filtros obligatorios por `companyId`)
- ✅ Validación de ownership en cada consulta
- ✅ Tokens one-time para descargas seguras de documentos

**Gestión de contraseñas:**
- ✅ Longitud mínima: 8 caracteres
- ✅ Recomendación de complejidad (mayúsculas, minúsculas, números)
- ✅ Recuperación segura mediante tokens de un solo uso (caducidad 1h)
- ✅ No se almacenan contraseñas en texto plano
- ✅ Cambio de contraseña forzado en primera activación

#### 1.2. Cifrado

**En tránsito:**
- ✅ HTTPS obligatorio (TLS 1.3)
- ✅ Certificado SSL/TLS grado A+ (Let's Encrypt con renovación automática)
- ✅ HSTS (HTTP Strict Transport Security) habilitado
- ✅ Cifrado de extremo a extremo en comunicaciones

**En reposo:**
- ✅ Contraseñas: bcrypt (factor 12)
- ✅ Refresh tokens: hash SHA-256
- ✅ Tokens de activación: random token (64 caracteres)
- ✅ Base de datos: Cifrado de disco en Railway.app (AES-256)
- ✅ Backups: Cifrados con clave AES-256

**En cliente:**
- ✅ Tokens de sesión encriptados en localStorage (XOR + base64)
- ✅ No se almacena información sensible sin cifrar en navegador

#### 1.3. Auditoría y trazabilidad

**Logs de acceso:**
- ✅ IP, timestamp, acción, usuario
- ✅ Conservación: 2 años
- ✅ Monitorización de anomalías (intentos masivos de acceso)

**Audit trail de fichajes (RD-ley 8/2019):**
- ✅ Registro de toda modificación de fichajes
- ✅ Quién modificó, cuándo, qué cambió, motivo
- ✅ Valores antiguos y nuevos (JSON)
- ✅ Inmutable (no se pueden editar logs de auditoría)
- ✅ Conservación: Vida del registro + 4 años

**Logs de seguridad:**
- ✅ Intentos de acceso no autorizado
- ✅ Cambios de contraseña
- ✅ Exportaciones masivas de datos
- ✅ Eliminaciones de empleados/documentos

#### 1.4. Copias de seguridad (Backups)

- ✅ **Frecuencia:** Diaria (automática, 03:00 AM CET)
- ✅ **Retención:** 30 días
- ✅ **Cifrado:** AES-256
- ✅ **Ubicación:** Separada de producción (Railway.app backup storage)
- ✅ **Pruebas de restauración:** Trimestrales
- ✅ **RTO (Recovery Time Objective):** < 4 horas
- ✅ **RPO (Recovery Point Objective):** < 24 horas

#### 1.5. Protección de infraestructura

**Firewall:**
- ✅ Cloudflare WAF (Web Application Firewall)
- ✅ Reglas de seguridad OWASP Top 10
- ✅ Rate limiting por IP (máx. 100 req/min)
- ✅ Bloqueo de IPs sospechosas

**Protección DDoS:**
- ✅ Cloudflare DDoS Protection (capa 3, 4 y 7)
- ✅ Absorción de ataques de hasta 100 Gbps

**Actualizaciones:**
- ✅ Sistema operativo: Parches automáticos semanales
- ✅ Dependencias npm: Auditoría semanal (`npm audit`)
- ✅ Base de datos PostgreSQL: Actualizaciones mensuales (Railway.app)

**Segmentación de red:**
- ✅ Base de datos solo accesible desde aplicación
- ✅ No hay acceso directo externo a PostgreSQL
- ✅ Conexiones cifradas entre servicios (TLS interno)

#### 1.6. Desarrollo seguro

- ✅ Validación de entrada (sanitización con Zod)
- ✅ Prevención SQL injection (Drizzle ORM parametrizado)
- ✅ Prevención XSS (sanitización HTML en outputs)
- ✅ Prevención CSRF (tokens SameSite Strict)
- ✅ Cabeceras de seguridad (CSP, X-Frame-Options, X-Content-Type-Options)
- ✅ Dependencias auditadas (Dependabot, npm audit)
- ✅ Code review obligatorio antes de merge

---

### 2. MEDIDAS ORGANIZATIVAS

#### 2.1. Política de control de accesos

**Acceso al sistema:**
- ✅ Acceso concedido bajo principio de "mínimo privilegio"
- ✅ Revisión trimestral de permisos
- ✅ Revocación inmediata de accesos al cesar en el puesto
- ✅ Autenticación de dos factores (2FA) obligatoria para administradores

**Acceso a datos de clientes:**
- ✅ Solo personal técnico autorizado
- ✅ Acceso solo para soporte técnico justificado
- ✅ Registro de todos los accesos administrativos
- ✅ Sesiones con timeout de 30 minutos de inactividad

#### 2.2. Gestión de personal

**Selección:**
- ✅ Verificación de referencias
- ✅ Entrevistas con evaluación de responsabilidad

**Formación:**
- ✅ Formación inicial en protección de datos (RGPD)
- ✅ Formación continua (anual)
- ✅ Concienciación en seguridad (phishing, ingeniería social)

**Confidencialidad:**
- ✅ Cláusulas de confidencialidad en contratos
- ✅ Acuerdos de no divulgación (NDA)
- ✅ Obligación de confidencialidad permanente (post-contractual)

**Control de acceso físico:**
- ✅ Acceso restringido a oficinas
- ✅ Registro de visitantes
- ✅ Pantallas con bloqueo automático

#### 2.3. Procedimiento de gestión de brechas de seguridad

**Detección:**
- ✅ Monitorización 24/7 de logs de seguridad
- ✅ Alertas automáticas ante anomalías
- ✅ Canales de reporte (email security@oficaz.es)

**Respuesta:**
1. **Detección y registro** (tiempo 0)
2. **Evaluación de impacto** (0-6h):
   - Tipo de brecha
   - Datos afectados
   - Número de interesados
   - Gravedad
3. **Contención** (0-12h):
   - Bloqueo del origen de la brecha
   - Aislamiento de sistemas afectados
4. **Notificación al RESPONSABLE** (máx. 24h)
5. **Investigación y remediación** (24-72h)
6. **Notificación a AEPD si procede** (máx. 72h) - responsabilidad del RESPONSABLE con asistencia del ENCARGADO
7. **Notificación a interesados si procede** - responsabilidad del RESPONSABLE
8. **Informe post-incidente** (7 días):
   - Causa raíz
   - Medidas correctivas
   - Lecciones aprendidas

**Equipo de respuesta:**
- CTO (líder)
- Desarrollador senior
- Responsable de seguridad
- Asesor legal (si procede)

#### 2.4. Auditorías y certificaciones

**Auditorías internas:**
- ✅ Revisión trimestral de configuración de seguridad
- ✅ Simulacros de brechas de seguridad (anuales)
- ✅ Auditoría de logs de acceso (mensual)

**Auditorías externas:**
- ✅ Pentesting anual por empresa especializada
- ✅ Revisión de cumplimiento RGPD (bienal)

**Certificaciones objetivo:**
- 🎯 ISO 27001 (Gestión de Seguridad de la Información)
- 🎯 ISO 27701 (Gestión de Privacidad)
- 🎯 Esquema Nacional de Seguridad (ENS) - si contratación pública

#### 2.5. Plan de continuidad de negocio (BCP)

**Objetivo:**
- RTO (Recovery Time Objective): < 4 horas
- RPO (Recovery Point Objective): < 24 horas

**Medidas:**
- ✅ Backups automáticos diarios
- ✅ Infraestructura en cloud con alta disponibilidad
- ✅ Procedimiento de recuperación documentado
- ✅ Pruebas de recuperación trimestrales
- ✅ Equipo de guardia 24/7 (soporte técnico)

**Escenarios cubiertos:**
- Caída de base de datos
- Ataque DDoS
- Ransomware
- Fallo de proveedor cloud
- Desastre natural

---

## ANEXO III - CLÁUSULA INFORMATIVA PARA EMPLEADOS

**Modelo de información para que el RESPONSABLE informe a sus empleados**

---

### INFORMACIÓN SOBRE TRATAMIENTO DE DATOS PERSONALES - EMPLEADOS

De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), se le informa sobre el tratamiento de sus datos personales:

**RESPONSABLE DEL TRATAMIENTO:**  
[NOMBRE DE LA EMPRESA]  
NIF: [CIF]  
Dirección: [DIRECCIÓN]  
Email: [EMAIL]  
Teléfono: [TELÉFONO]

**ENCARGADO DEL TRATAMIENTO:**  
Oficaz - Software de Gestión Laboral  
NIF: [CIF DE OFICAZ]  
Email: info@oficaz.es

---

**1. FINALIDADES Y BASE JURÍDICA**

Sus datos personales serán tratados para las siguientes finalidades:

| Finalidad | Base Jurídica |
|-----------|---------------|
| Gestión de la relación laboral | Ejecución del contrato de trabajo |
| Control horario obligatorio (fichajes) | Obligación legal (RD-ley 8/2019) |
| Gestión de nóminas | Ejecución del contrato + obligación legal |
| Gestión de vacaciones y ausencias | Ejecución del contrato |
| Comunicaciones internas | Interés legítimo (organización del trabajo) |
| Archivo documental (nóminas, contratos) | Obligación legal (laboral, fiscal) |
| Geolocalización en fichajes (opcional) | **Consentimiento (puede denegar)** |
| Fotografía de perfil (opcional) | **Consentimiento (puede denegar)** |

---

**2. DATOS QUE TRATAMOS**

- **Identificación:** Nombre, DNI, fotografía (opcional)
- **Contacto:** Email, teléfono, dirección postal
- **Laborales:** Puesto, fecha de alta, rol en aplicación
- **Jornada laboral:** Fichajes (fecha/hora entrada/salida), descansos, ubicación GPS (si consiente)
- **Vacaciones:** Solicitudes, días disponibles/usados
- **Documentos:** Nóminas, contratos, partes de trabajo
- **Contacto emergencia:** Nombre y teléfono de persona de contacto

---

**3. CONSERVACIÓN DE DATOS**

- **Durante relación laboral:** Mientras esté activo en la empresa
- **Tras finalización:** 4 años (prescripción de infracciones laborales)
- **Fichajes:** 4 años (obligación legal RD-ley 8/2019)
- **Nóminas:** 4 años (obligación fiscal)
- **Contratos:** Durante relación + 4 años

---

**4. DESTINATARIOS**

Sus datos pueden ser comunicados a:

- **Oficaz (encargado del tratamiento):** Para gestión de la aplicación
- **Asesoría laboral:** Para gestión de nóminas (si procede)
- **Administración Tributaria (AEAT):** Obligación legal
- **Inspección de Trabajo:** Obligación legal
- **Juzgados:** Por requerimiento judicial

**NO se ceden datos a terceros con fines comerciales.**

---

**5. SUS DERECHOS**

Puede ejercer los siguientes derechos:

- ✅ **Acceso:** Obtener confirmación y copia de sus datos
- ✅ **Rectificación:** Corregir datos inexactos
- ✅ **Supresión:** Solicitar eliminación (sujeto a obligaciones legales)
- ✅ **Limitación:** Solicitar bloqueo del tratamiento
- ✅ **Oposición:** Oponerse al tratamiento (salvo obligación legal)
- ✅ **Portabilidad:** Recibir datos en formato estructurado
- ✅ **No ser objeto de decisiones automatizadas**

**Cómo ejercer sus derechos:**

- Dirigirse a RRHH de la empresa
- Email: [EMAIL EMPRESA] o info@oficaz.es
- Acreditar identidad (copia DNI)

**Plazo de respuesta:** 1 mes

**Derecho a reclamar:**

Si considera vulnerados sus derechos, puede reclamar ante:

**Agencia Española de Protección de Datos (AEPD)**  
C/ Jorge Juan, 6 - 28001 Madrid  
www.aepd.es  
Teléfono: 901 100 099

---

**6. CONSENTIMIENTOS ESPECÍFICOS**

### Geolocalización en fichajes (OPCIONAL)

Al fichar entrada/salida, la aplicación puede solicitar su ubicación GPS.

- ✅ **Es opcional:** Puede denegar y el fichaje se registrará sin ubicación
- ✅ **Solo se guarda si acepta:** Coordenadas GPS con precisión ~10 metros
- ✅ **Puede revocar:** En cualquier momento desde configuración de perfil
- ✅ **No bloquea el servicio:** La app funciona perfectamente sin geolocalización

**Finalidad:** Verificar ubicación en fichajes  
**Conservación:** Durante relación laboral + 4 años

**¿Acepta compartir su ubicación al fichar?**

[  ] SÍ, acepto  
[  ] NO, no acepto (podrá fichar sin ubicación)

---

### Fotografía de perfil (OPCIONAL)

Puede subir una foto de perfil para identificación visual en la aplicación.

- ✅ **Totalmente opcional:** Puede usar avatar con iniciales
- ✅ **Puede eliminarla:** En cualquier momento desde su perfil
- ✅ **Tamaño:** Redimensión automática a 200x200px

**Finalidad:** Identificación visual en aplicación  
**Conservación:** Mientras esté activa en su perfil

**¿Desea subir foto de perfil?**

[  ] SÍ, subiré una foto  
[  ] NO, usaré avatar con iniciales

---

**ACEPTO haber sido informado sobre el tratamiento de mis datos personales y entiendo mis derechos.**

Fecha: ____________

Firma del empleado: ___________________________

---

*Este documento debe entregarse al empleado en el momento de la contratación y antes de comenzar a usar la aplicación Oficaz.*

---

## FIRMA DEL CONTRATO

**EL RESPONSABLE DEL TRATAMIENTO**  
[NOMBRE DE LA EMPRESA CLIENTE]  
CIF: _______________  
Representante: _______________  
Cargo: _______________

Firma: _______________  
Fecha: _______________

---

**EL ENCARGADO DEL TRATAMIENTO**  
Oficaz - Software de Gestión Laboral  
NIF: 09055639X  
Representante: José Ángel García Márquez  
Cargo: Responsable Único / Representante Legal

Firma: _______________  
Fecha: _______________

---

**[Sello de la empresa]**

---

**FIN DEL CONTRATO**

Este contrato ha sido generado automáticamente por Oficaz y adaptado a la normativa española de protección de datos (RGPD + LOPDGDD).

**Versión:** 1.0  
**Fecha:** 16 de enero de 2026  
**Última revisión:** 16 de enero de 2026
