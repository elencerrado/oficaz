# MEDIDAS DE SEGURIDAD TÉCNICAS Y ORGANIZATIVAS
## Documentación de cumplimiento RGPD - Oficaz

**Fecha:** 16 de enero de 2026  
**Versión:** 1.0  
**Responsable:** José Ángel García Márquez (DNI: 09055639X)  
**Próxima revisión:** 16 de julio de 2026

---

## 1. INTRODUCCIÓN

### 1.1. Objeto

Este documento describe las **medidas técnicas y organizativas** implementadas por **Oficaz** para garantizar un nivel de seguridad adecuado al riesgo del tratamiento de datos personales, conforme al **Artículo 32 del RGPD**.

### 1.2. Marco normativo

- **Artículo 32 RGPD:** Seguridad del tratamiento
- **Artículo 5.1.f RGPD:** Principio de integridad y confidencialidad
- **Esquema Nacional de Seguridad (ENS)** - Referencia (si aplica contratación pública)

### 1.3. Criterios de seguridad

Las medidas implementadas garantizan:

- ✅ **Confidencialidad:** Solo personal autorizado accede a los datos
- ✅ **Integridad:** Los datos no se modifican indebidamente
- ✅ **Disponibilidad:** Los datos están accesibles cuando se necesitan
- ✅ **Resiliencia:** Capacidad de recuperación ante incidentes

---

## 2. MEDIDAS TÉCNICAS

### 2.1. Control de acceso

#### 2.1.1. Autenticación

**Sistema de autenticación:**

- **JWT (JSON Web Tokens):**
  - Access token: Caducidad **15 minutos**
  - Refresh token: Caducidad **30 días** (rotación automática)
  - Tokens almacenados cifrados en cliente (XOR + base64)

- **Contraseñas:**
  - Hash: **bcrypt** con factor de coste **12**
  - Longitud mínima: **8 caracteres**
  - Recomendación de complejidad (mayúsculas, minúsculas, números, símbolos)
  - **NO se almacenan en texto plano** en ningún momento

- **Recuperación de contraseña:**
  - Token de un solo uso (random 64 caracteres)
  - Caducidad: **1 hora**
  - Envío por email a dirección registrada
  - Token invalidado tras uso o caducidad

- **Bloqueo de cuenta:**
  - Tras **5 intentos fallidos** de login
  - Bloqueo temporal: **15 minutos**
  - Notificación por email al usuario

**Autenticación multifactor (2FA):**

- ✅ Disponible (TOTP - Time-based One-Time Password)
- ⏳ **Pendiente:** Hacer obligatorio para administradores (Plan de acción M1)

**Estado:** ✅ Implementado (2FA opcional), ⏳ Pendiente (2FA obligatorio para admins)

---

#### 2.1.2. Autorización

**Control de acceso basado en roles (RBAC):**

| Rol | Permisos | Alcance |
|-----|----------|---------|
| **Super Admin** | Gestión de plataforma Oficaz | Global (todos los clientes) |
| **Admin Empresa** | Gestión completa de su empresa | Su empresa únicamente |
| **Manager** | Gestión de empleados, aprobación de vacaciones | Su empresa únicamente |
| **Empleado** | Ver sus propios datos, fichar, solicitar vacaciones | Solo sus datos |

**Segregación multi-tenant:**

- ✅ Todos los datos filtrados por `companyId` (empresa)
- ✅ Validación en backend: Un admin de empresa A **NO puede** ver datos de empresa B
- ✅ Consultas SQL parametrizadas con cláusula `WHERE companyId = ?`
- ✅ Middleware de validación de ownership en todas las rutas protegidas

**Ejemplo de validación:**

```typescript
// Middleware que valida que el usuario solo acceda a datos de su empresa
async function validateOwnership(req, res, next) {
  const userCompanyId = req.user.companyId;
  const requestedCompanyId = req.params.companyId;
  
  if (userCompanyId !== requestedCompanyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  next();
}
```

**Tokens de descarga seguros:**

- ✅ URLs firmadas para descarga de documentos (nóminas, contratos)
- ✅ Token de un solo uso (no reutilizable)
- ✅ Caducidad: **1 hora**
- ✅ Solo el empleado destinatario puede generar/usar el token

**Estado:** ✅ Implementado

---

#### 2.1.3. Gestión de sesiones

**Características:**

- ✅ Timeout de inactividad: **30 minutos** (configurable por empresa)
- ✅ Cierre de sesión automático tras timeout
- ✅ Logout manual disponible (invalida refresh token)
- ✅ Logout de todas las sesiones (invalida todos los refresh tokens del usuario)

**Almacenamiento de sesiones:**

- Access tokens: Solo en memoria (RAM) en cliente
- Refresh tokens: localStorage cifrado (XOR + base64) + hasheado en base de datos (SHA-256)

**Estado:** ✅ Implementado

---

### 2.2. Cifrado

#### 2.2.1. Cifrado en tránsito

**HTTPS/TLS:**

- ✅ Protocolo: **TLS 1.3** (mínimo TLS 1.2)
- ✅ Certificado SSL: **Let's Encrypt** con renovación automática
- ✅ Calificación: **A+** (SSL Labs)
- ✅ **HSTS (HTTP Strict Transport Security)** habilitado:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- ✅ Redirección automática HTTP → HTTPS

**Cifrado entre servicios:**

- ✅ Conexión aplicación ↔ base de datos: TLS interno
- ✅ Conexión aplicación ↔ Stripe: HTTPS (obligatorio por Stripe)
- ✅ Conexión aplicación ↔ Railway/Cloudflare: HTTPS

**Estado:** ✅ Implementado

---

#### 2.2.2. Cifrado en reposo

**Base de datos (PostgreSQL en Railway):**

- ✅ Cifrado de disco: **AES-256** (proporcionado por Railway)
- ✅ Conexión cifrada desde aplicación (TLS)
- ⏳ **Pendiente:** Cifrado adicional de campos sensibles (geolocalización) - Plan de acción M2

**Contraseñas:**

- ✅ Hash: **bcrypt** con factor 12 (no es cifrado reversible, es hash one-way)
- ✅ **NO se almacenan en texto plano**
- ✅ **NO son recuperables** (solo se pueden resetear)

**Refresh tokens:**

- ✅ Hash: **SHA-256** en base de datos
- ✅ Token original solo visible en momento de emisión (luego solo hash)

**Tokens de activación/recuperación:**

- ✅ Random token de 64 caracteres
- ✅ Hasheado en base de datos (SHA-256)
- ✅ Caducidad incorporada

**Backups:**

- ✅ Cifrado: **AES-256**
- ✅ Clave de cifrado separada de los backups
- ✅ Almacenados en Railway Backup Storage (separado de producción)

**Archivos subidos (documentos, fotos):**

- ⚠️ Actualmente sin cifrado adicional (confían en cifrado de disco de Railway)
- 🔹 **Recomendación futura:** Cifrar archivos antes de almacenar (AES-256 con clave por empresa)

**Estado:** ✅ Implementado (básico), 🔹 Mejorable (cifrado de campos sensibles)

---

#### 2.2.3. Cifrado en cliente

**Tokens de sesión:**

- ✅ Cifrado en localStorage: XOR + base64 (ofuscación básica)
- ⚠️ **Nota:** No es cifrado fuerte, pero previene lectura casual

**Contraseñas en tránsito:**

- ✅ Solo se envían por HTTPS (TLS 1.3)
- ✅ **NO se almacenan en localStorage**

**Estado:** ✅ Implementado

---

### 2.3. Auditoría y trazabilidad

#### 2.3.1. Logs de acceso

**Qué se registra:**

- ✅ Intentos de login (exitosos y fallidos)
- ✅ IP del usuario
- ✅ Timestamp
- ✅ Email usado para login
- ✅ Resultado (éxito/fallo/bloqueado)

**Conservación:** 2 años

**Acceso:** Solo CTO, responsable de seguridad, DPO

**Estado:** ✅ Implementado

---

#### 2.3.2. Audit trail de fichajes (RD-ley 8/2019)

**Qué se registra:**

- ✅ **Toda modificación** de un fichaje (entrada/salida/descanso)
- ✅ Usuario que modificó (admin/manager)
- ✅ Timestamp de la modificación
- ✅ Valores antiguos (antes de modificar)
- ✅ Valores nuevos (después de modificar)
- ✅ Motivo de la modificación (texto libre)
- ✅ IP del modificador

**Características:**

- ✅ **Inmutable:** No se pueden editar ni eliminar registros de auditoría
- ✅ Formato: JSON con valores old/new
- ✅ Conservación: **Vida del registro + 4 años**
- ✅ Accesible por Inspección de Trabajo

**Ejemplo de registro:**

```json
{
  "workSessionId": 12345,
  "modifiedBy": "admin@empresa.com",
  "modifiedAt": "2026-01-16T10:30:00Z",
  "modifiedFromIp": "192.168.1.100",
  "reason": "Empleado olvidó fichar salida",
  "changes": {
    "clockOut": {
      "old": null,
      "new": "2026-01-15T18:00:00Z"
    }
  }
}
```

**Estado:** ✅ Implementado

---

#### 2.3.3. Logs de seguridad

**Eventos registrados:**

- ✅ Cambios de contraseña
- ✅ Activación de cuenta
- ✅ Exportaciones masivas de datos (>50 registros)
- ✅ Eliminación de empleados
- ✅ Eliminación de empresas
- ✅ Accesos administrativos (Super Admin)
- ✅ Errores de autorización (intentos de acceso no permitido)

**Conservación:** 2 años

**Estado:** ✅ Implementado

---

### 2.4. Copias de seguridad (Backups)

**Características:**

- ✅ **Frecuencia:** Diaria automática (03:00 AM CET)
- ✅ **Retención:** 30 días
- ✅ **Cifrado:** AES-256
- ✅ **Ubicación:** Separada de producción (Railway Backup Storage)
- ✅ **Pruebas de restauración:** Trimestrales
- ✅ **Responsable:** DevOps / CTO

**Objetivos de recuperación:**

- **RTO (Recovery Time Objective):** < 4 horas
- **RPO (Recovery Point Objective):** < 24 horas (último backup)

**Proceso de restauración:**

1. Detectar necesidad de restauración (pérdida de datos, corrupción)
2. Contactar con Railway.app (si es urgente)
3. Seleccionar punto de restauración (última versión correcta)
4. Restaurar en entorno de staging (verificación)
5. Si OK, restaurar en producción
6. Verificar integridad de datos
7. Notificar a clientes afectados (si procede)

**Pruebas realizadas:**

- ✅ Última prueba: [Fecha de última prueba]
- ⏳ Próxima prueba: [Fecha + 3 meses]

**Estado:** ✅ Implementado

**Mejora recomendada:** 🔹 Backups offline mensuales (air-gapped) - Plan de acción M8

---

### 2.5. Protección de infraestructura

#### 2.5.1. Firewall de aplicaciones web (WAF)

**Proveedor:** Cloudflare WAF

**Características:**

- ✅ Protección contra OWASP Top 10:
  - SQL Injection
  - XSS (Cross-Site Scripting)
  - CSRF (Cross-Site Request Forgery)
  - File inclusion
  - Command injection
  - Path traversal

- ✅ Reglas gestionadas por Cloudflare (actualizadas automáticamente)
- ✅ Reglas personalizadas (si procede)
- ✅ Rate limiting:
  - Máximo **100 peticiones/minuto** por IP
  - Bloqueo temporal tras exceder límite

- ✅ Bloqueo de IPs sospechosas:
  - Listas negras (blocklists) de IPs maliciosas
  - Bloqueo de países (si es necesario)

**Estado:** ✅ Implementado

---

#### 2.5.2. Protección anti-DDoS

**Proveedor:** Cloudflare

**Características:**

- ✅ Protección en capas 3, 4 y 7 (OSI)
- ✅ Absorción de ataques de hasta **100 Gbps**
- ✅ Mitigación automática (sin intervención manual)
- ✅ Always Online (caché estática si servidor cae)

**Estado:** ✅ Implementado

---

#### 2.5.3. Protección de base de datos

**Medidas:**

- ✅ **Acceso restringido:**
  - Base de datos solo accesible desde aplicación (no desde internet)
  - Railway internal network (sin IP pública directa)

- ✅ **Consultas parametrizadas:**
  - Uso de Drizzle ORM (prevención de SQL injection)
  - **NO se construyen consultas con concatenación de strings**

- ✅ **Principio de mínimo privilegio:**
  - Usuario de aplicación solo tiene permisos necesarios (SELECT, INSERT, UPDATE, DELETE)
  - **NO tiene permisos DROP, ALTER TABLE, CREATE DATABASE**

- ✅ **Conexión cifrada:**
  - TLS entre app y PostgreSQL

**Estado:** ✅ Implementado

---

#### 2.5.4. Actualizaciones de seguridad

**Sistema operativo (Railway.app):**

- ✅ Parches automáticos semanales (gestionado por Railway)

**Dependencias npm:**

- ✅ Auditoría semanal: `npm audit`
- ✅ Actualizaciones mensuales de dependencias
- ✅ **Dependabot** (GitHub) activado para alertas de vulnerabilidades

**Base de datos PostgreSQL:**

- ✅ Actualizaciones mensuales (gestionado por Railway)
- ✅ Versión actual: PostgreSQL 15+

**Aplicación:**

- ✅ Despliegue continuo (CI/CD)
- ✅ Pruebas automáticas antes de cada deploy
- ✅ Rollback inmediato si se detectan problemas

**Estado:** ✅ Implementado

---

### 2.6. Desarrollo seguro

#### 2.6.1. Validación de entrada

**Librería:** Zod (TypeScript schema validation)

**Qué se valida:**

- ✅ Todos los inputs de usuario (formularios, APIs)
- ✅ Tipos de datos (string, number, email, fecha, etc.)
- ✅ Longitud (mínimo/máximo)
- ✅ Formato (regex para email, teléfono, etc.)
- ✅ Valores permitidos (whitelist)

**Sanitización:**

- ✅ HTML sanitizado en outputs (prevención XSS)
- ✅ URLs validadas antes de redirección (prevención open redirect)

**Estado:** ✅ Implementado

---

#### 2.6.2. Prevención de vulnerabilidades

**SQL Injection:**

- ✅ Drizzle ORM con consultas parametrizadas
- ✅ **NO se usa SQL raw** (salvo casos excepcionales con validación estricta)

**XSS (Cross-Site Scripting):**

- ✅ Sanitización de HTML en outputs
- ✅ Content Security Policy (CSP) configurada
- ✅ React escapa automáticamente variables en JSX

**CSRF (Cross-Site Request Forgery):**

- ✅ Tokens SameSite=Strict en cookies
- ✅ CORS configurado (solo orígenes autorizados)

**Inyección de comandos:**

- ✅ **NO se ejecutan comandos del sistema** con input de usuario

**Path traversal:**

- ✅ Validación de rutas de archivos
- ✅ **NO se permite `../` en nombres de archivo**

**Estado:** ✅ Implementado

---

#### 2.6.3. Cabeceras de seguridad HTTP

**Cabeceras configuradas:**

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.stripe.com;
```

**Estado:** ✅ Implementado

---

#### 2.6.4. Revisión de código (Code review)

**Proceso:**

- ✅ Pull requests obligatorias (no commits directos a `main`)
- ✅ Revisión por al menos 1 desarrollador senior
- ✅ Checklist de seguridad:
  - ¿Se validan los inputs?
  - ¿Hay riesgo de SQL injection?
  - ¿Se exponen datos sensibles en logs?
  - ¿Se gestionan correctamente los errores?

**Estado:** ✅ Implementado

---

### 2.7. Segmentación de entornos

**Entornos separados:**

- ✅ **Producción:** Datos reales de clientes
- ✅ **Staging:** Datos de prueba (copia de producción)
- ✅ **Desarrollo:** Datos ficticios

**Acceso:**

- Producción: Solo CTO + DevOps (con 2FA)
- Staging: Equipo de desarrollo
- Desarrollo: Todos los desarrolladores

**Datos de producción:**

- ⚠️ **NO se copian datos de producción a desarrollo** (salvo anonimizados)
- ✅ Staging puede tener copia de producción (solo accesible por CTO)

**Estado:** ✅ Implementado

---

## 3. MEDIDAS ORGANIZATIVAS

### 3.1. Política de control de accesos

#### 3.1.1. Principio de mínimo privilegio

- ✅ Acceso concedido solo cuando es estrictamente necesario
- ✅ Revisión trimestral de permisos
- ✅ Revocación inmediata al cesar en el puesto

#### 3.1.2. Acceso a datos de clientes

**Reglas:**

- ✅ Solo personal técnico autorizado (CTO, DevOps, Dev Senior)
- ✅ Solo para soporte técnico justificado (ticket de cliente)
- ✅ Registro de todos los accesos administrativos:
  - Quién accedió
  - A qué datos
  - Cuándo
  - Por qué (nº de ticket de soporte)

- ✅ Sesiones con timeout: **30 minutos** de inactividad

**Estado:** ✅ Implementado

---

### 3.2. Gestión de personal

#### 3.2.1. Selección

- ✅ Verificación de referencias
- ✅ Entrevistas con evaluación de responsabilidad y ética

#### 3.2.2. Formación

**Formación inicial:**

- ✅ Inducción en protección de datos (RGPD básico)
- ✅ Políticas de seguridad de la empresa
- ✅ Uso adecuado de contraseñas, 2FA
- ✅ Detección de phishing y amenazas

**Duración:** 2 horas

**Formación continua:**

- ✅ Actualización anual en RGPD
- ✅ Concienciación en seguridad (phishing, ingeniería social)
- ✅ Simulacros de phishing

**Frecuencia:** Anual

**Estado:** ✅ Implementado (inicial), ⏳ Pendiente (simulacros anuales)

---

#### 3.2.3. Confidencialidad

**Cláusulas en contratos:**

- ✅ Cláusula de confidencialidad en todos los contratos de empleados
- ✅ Acuerdos de no divulgación (NDA) para colaboradores externos
- ✅ Obligación de confidencialidad **permanente** (incluso tras finalizar contrato)

**Sanciones:**

- ⚠️ Incumplimiento de confidencialidad puede conllevar:
  - Despido disciplinario
  - Responsabilidad civil (indemnización por daños)
  - Responsabilidad penal (si procede)

**Estado:** ✅ Implementado

---

### 3.3. Control de acceso físico

**Medidas:**

- ✅ Acceso restringido a oficinas (tarjeta/llave)
- ✅ Registro de visitantes (libro de visitas)
- ✅ Pantallas con bloqueo automático (5 minutos inactividad)
- ✅ Política de escritorio limpio (clean desk policy):
  - No dejar documentos sensibles en mesa
  - Bloquear ordenador al levantarse

**Dispositivos:**

- ✅ Cifrado de disco en portátiles (BitLocker, FileVault)
- ✅ Contraseña en arranque
- ✅ No se almacenan datos de clientes en local (salvo cache temporal cifrado)

**Estado:** ✅ Implementado

---

### 3.4. Gestión de incidentes

**Procedimiento:**

- ✅ Procedimiento de Gestión de Brechas de Seguridad documentado (ver PROCEDIMIENTO_BRECHAS_SEGURIDAD.md)
- ✅ Equipo CSIRT (Computer Security Incident Response Team) definido
- ✅ Plazo de notificación a AEPD: **Máximo 72 horas**
- ✅ Plazo de notificación a clientes (responsables): **Máximo 24 horas**

**Registro de incidentes:**

- ✅ Todas las brechas se documentan (incluso las que NO requieren notificación a AEPD)
- ✅ Registro conservado indefinidamente

**Estado:** ✅ Implementado

---

### 3.5. Auditorías y certificaciones

#### 3.5.1. Auditorías internas

**Frecuencia:** Trimestral

**Alcance:**

- Revisión de configuración de seguridad (Railway, Cloudflare)
- Auditoría de logs de acceso (muestras aleatorias)
- Verificación de backups (integridad, restauración)
- Revisión de permisos de usuarios

**Responsable:** CTO / Responsable de Seguridad

**Estado:** ✅ Implementado

---

#### 3.5.2. Auditorías externas

**Pentesting (pruebas de penetración):**

- ⏳ **Pendiente:** Contratar empresa especializada (Plan de acción M5)
- Frecuencia objetivo: Anual
- Alcance: Infraestructura, aplicación web, APIs

**Revisión de cumplimiento RGPD:**

- ⏳ **Pendiente:** Auditoría externa de cumplimiento
- Frecuencia objetivo: Bienal (cada 2 años)

**Estado:** ⏳ Pendiente

---

#### 3.5.3. Certificaciones objetivo

**Objetivo a medio-largo plazo:**

- 🎯 **ISO 27001:** Gestión de Seguridad de la Información
- 🎯 **ISO 27701:** Gestión de Privacidad
- 🎯 **ENS:** Esquema Nacional de Seguridad (si contratación pública)

**Plazo:** 12-24 meses

**Estado:** ⏳ Pendiente (Plan de acción M10)

---

### 3.6. Plan de continuidad de negocio (BCP)

**Objetivo:**

- RTO (Recovery Time Objective): **< 4 horas**
- RPO (Recovery Point Objective): **< 24 horas**

**Medidas:**

- ✅ Backups automáticos diarios
- ✅ Infraestructura en cloud (alta disponibilidad)
- ✅ Procedimiento de recuperación documentado
- ✅ Pruebas de recuperación trimestrales
- ✅ Equipo de guardia 24/7 (soporte técnico)

**Escenarios cubiertos:**

- Caída de base de datos → Restaurar desde backup
- Ataque DDoS → Cloudflare mitiga automáticamente
- Ransomware → Restaurar desde backup cifrado
- Fallo de Railway → Migrar a otro proveedor (Railway permite exportación)
- Desastre natural → Infraestructura cloud distribuida

**Estado:** ✅ Implementado

---

## 4. CUMPLIMIENTO DE SUBENCARGADOS

**Exigencias a subencargados:**

- ✅ Todos los subencargados firman Contrato de Encargo de Tratamiento
- ✅ Garantías de seguridad equivalentes (certificaciones ISO, SOC 2)
- ✅ Cláusulas Contractuales Tipo UE (transferencias internacionales)
- ✅ Derecho de auditoría sobre subencargados

**Subencargados auditados:**

| Subencargado | Certificaciones | Última auditoría |
|--------------|-----------------|------------------|
| Stripe | PCI-DSS nivel 1, ISO 27001, SOC 2 Tipo II | Anual (por Stripe) |
| Railway.app | ISO 27001 | Pendiente (solicitar informe) |
| Cloudflare | ISO 27001, SOC 2 Tipo II | Anual (por Cloudflare) |

**Estado:** ✅ Implementado

---

## 5. RESUMEN DE MEDIDAS

### 5.1. Checklist de medidas implementadas

**Medidas técnicas:**

- ✅ Autenticación robusta (JWT + bcrypt)
- ✅ Autorización basada en roles (RBAC)
- ✅ Segregación multi-tenant estricta
- ✅ Cifrado en tránsito (TLS 1.3)
- ✅ Cifrado en reposo (AES-256 en disco)
- ✅ Auditoría completa de fichajes (RD-ley 8/2019)
- ✅ Logs de acceso y seguridad (2 años)
- ✅ Backups diarios cifrados (30 días retención)
- ✅ Firewall WAF (Cloudflare)
- ✅ Protección anti-DDoS
- ✅ Rate limiting (100 req/min)
- ✅ Actualizaciones de seguridad automáticas
- ✅ Validación de entrada (Zod)
- ✅ Prevención SQL injection (Drizzle ORM)
- ✅ Prevención XSS (sanitización HTML)
- ✅ Cabeceras de seguridad HTTP
- ✅ Code review obligatorio

**Medidas organizativas:**

- ✅ Política de mínimo privilegio
- ✅ Registro de accesos administrativos
- ✅ Formación inicial en protección de datos
- ✅ Cláusulas de confidencialidad en contratos
- ✅ Control de acceso físico a oficinas
- ✅ Cifrado de discos en portátiles
- ✅ Procedimiento de gestión de brechas documentado
- ✅ Registro de violaciones de seguridad
- ✅ Auditorías internas trimestrales
- ✅ Plan de continuidad de negocio (BCP)
- ✅ Backups probados trimestralmente
- ✅ Contratos de Encargo con subencargados

---

### 5.2. Medidas pendientes (Plan de acción)

**Prioridad ALTA (1-3 meses):**

- ⏳ M1: **2FA obligatorio para administradores**
- ⏳ M2: **Cifrado de geolocalización en BBDD**
- ⏳ M4: **Hosting exclusivo en UE (Railway)**

**Prioridad MEDIA (3-6 meses):**

- ⏳ M5: **Pentesting anual externo**
- ⏳ M7: **Formación obligatoria para empleadores**
- ⏳ M8: **Backups offline mensuales**

**Prioridad BAJA (6-12 meses):**

- ⏳ M9: **IDS/IPS (Intrusion Detection System)**
- ⏳ M10: **Certificación ISO 27001**

---

## 6. EVALUACIÓN DE ADECUACIÓN

### 6.1. ¿Las medidas son adecuadas al riesgo?

**SÍ**, porque:

- ✅ Los riesgos identificados (Análisis de Riesgos) están **controlados**
- ✅ Las medidas cubren los **3 pilares de seguridad** (confidencialidad, integridad, disponibilidad)
- ✅ Se aplican **medidas técnicas y organizativas** de forma complementaria
- ✅ Se tienen en cuenta las **mejores prácticas** del sector (OWASP, ISO 27001, NIST)
- ✅ Se cumplen los requisitos del **Art. 32 RGPD**

### 6.2. ¿Se pueden mejorar?

**SÍ**, siempre hay margen de mejora:

- 🔹 Certificación ISO 27001 (objetivo a 12 meses)
- 🔹 Cifrado de campos sensibles en BBDD (geolocalización)
- 🔹 IDS/IPS para detección avanzada de intrusiones
- 🔹 Bug bounty program (recompensas por vulnerabilidades encontradas)

**Pero las medidas actuales son suficientes para garantizar un nivel de seguridad adecuado al riesgo.**

---

## 7. APROBACIÓN Y SEGUIMIENTO

### 7.1. Aprobación

**Elaborado por:** [Nombre del CTO / Responsable de Seguridad]  
**Fecha:** 16 de enero de 2026

**Revisado por:** [Nombre del DPO / Responsable Legal]  
**Fecha:** 16 de enero de 2026

**Aprobado por:** [Nombre del CEO]  
**Fecha:** 16 de enero de 2026

---

### 7.2. Seguimiento

**Revisión del documento:**

- **Frecuencia:** Semestral (cada 6 meses)
- **Próxima revisión:** 16 de julio de 2026

**Triggers para revisión extraordinaria:**

- Incidente de seguridad grave
- Cambios en infraestructura (migración a nuevo proveedor)
- Nuevos tratamientos de datos
- Cambios legislativos (RGPD, guías de AEPD)
- Resultados de pentesting (nuevas vulnerabilidades)

**Responsable de actualización:** CTO / Responsable de Seguridad

---

**FIN DEL DOCUMENTO**

**Versión:** 1.0  
**Fecha:** 16 de enero de 2026

Este documento se complementa con:

- **ANALISIS_RIESGOS.md** (evaluación de riesgos)
- **PROCEDIMIENTO_BRECHAS_SEGURIDAD.md** (respuesta a incidentes)
- **CONTRATO_ENCARGO_TRATAMIENTO.md** (Anexo II - Medidas de Seguridad)
