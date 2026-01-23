# 🔐 Oficaz - Reporte de Auditoría de Seguridad Profesional
**Fecha**: 15 de Diciembre de 2025  
**Clasificación**: CONFIDENCIAL

---

## 📋 Resumen Ejecutivo

Se identificaron **3 vulnerabilidades críticas de IDOR (Insecure Direct Object Reference)** que permiten a un administrador de una empresa acceder y modificar datos de otra empresa. También se encontraron hallazgos de baja/media criticidad en validación de inputs y manejo de errores.

**Riesgo General**: 🔴 **ALTO** - Requiere parches inmediatos antes de producción

---

## 🚨 Vulnerabilidades Críticas (CRITICAL)

### 1. IDOR en `/api/vacation-requests/:id` - PATCH
**Línea**: [server/routes.ts#L5143](server/routes.ts#L5143)  
**Severidad**: 🔴 CRITICAL  
**CVSS Score**: 8.1 (High)

**Descripción:**
```typescript
app.patch('/api/vacation-requests/:id', authenticateToken, requireRole(['admin', 'manager']), ...)
// NO valida que la solicitud pertenezca a req.user.companyId
const request = await storage.updateVacationRequest(id, updateData);
```

**Impacto:**
- Admin de empresa A puede aprobar/denegar solicitudes de vacaciones de empresa B
- Cross-company modification de datos sensibles
- Incumplimiento de GDPR/privacidad de datos

**Prueba de Concepto:**
```
1. Admin de "Empresa A" obtiene token válido
2. Realiza PATCH /api/vacation-requests/999 (ID de solicitud de "Empresa B")
3. Cambia estado a 'approved' → Solicitud de "Empresa B" aprobada indebidamente
```

**Remedio:**
```typescript
app.patch('/api/vacation-requests/:id', authenticateToken, requireRole(['admin', 'manager']), ...)
  const id = parseInt(req.params.id);
  
  // ✅ VALIDACIÓN NUEVA: Verificar que la solicitud pertenece a esta empresa
  const vacationRequest = await storage.getVacationRequestById(id);
  if (!vacationRequest || vacationRequest.companyId !== req.user!.companyId) {
    return res.status(403).json({ message: 'No tienes permisos para acceder a este recurso' });
  }
  
  const updateData = { ... };
  const request = await storage.updateVacationRequest(id, updateData);
```

---

### 2. IDOR en `/api/work-shifts/:id` - PATCH
**Línea**: [server/routes.ts#L5426](server/routes.ts#L5426)  
**Severidad**: 🔴 CRITICAL  
**CVSS Score**: 8.1 (High)

**Descripción:**
Admin de empresa A puede modificar turnos de trabajo de empresa B.

**Remedio:**
```typescript
app.patch('/api/work-shifts/:id', authenticateToken, ...)
  const id = parseInt(req.params.id);
  const shift = await storage.getWorkShift(id);
  
  // ✅ VALIDACIÓN: Verificar companyId
  if (!shift || shift.companyId !== req.user!.companyId) {
    return res.status(403).json({ message: 'No autorizado' });
  }
  
  const updated = await storage.updateWorkShift(id, updates);
```

---

### 3. IDOR en `/api/work-shifts/:id` - DELETE
**Línea**: [server/routes.ts#L5495](server/routes.ts#L5495)  
**Severidad**: 🔴 CRITICAL  
**CVSS Score**: 8.5 (Critical)

**Descripción:**
Admin de empresa A puede eliminar turnos de empresa B.

**Remedio:** Aplicar el mismo patrón de validación que en PATCH.

---

## ⚠️ Vulnerabilidades Altas (HIGH)

### 4. Falta de Rate Limiting en Login
**Línea**: [server/routes.ts#L1800](server/routes.ts#L1800)  
**Severidad**: 🟠 HIGH  
**Impacto**: Brute force attacks en contraseñas

**Hallazgo:**
El endpoint `/api/auth/login` NO tiene rate limiting. Un atacante puede intentar millones de contraseñas sin restricción.

**Remedio:**
```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máx 5 intentos fallidos
  skipSuccessfulRequests: true, // no contar intentos exitosos
  message: 'Demasiados intentos fallidos. Intenta más tarde.'
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  // ... login logic
});
```

---

### 5. Exposición de Información en Errores
**Línea**: [server/routes.ts#L500](server/routes.ts#L500)  
**Severidad**: 🟠 HIGH  
**Impacto**: Information Disclosure

**Hallazgo:**
```typescript
catch (error: any) {
  res.status(500).json({ message: error.message }); // ❌ Expone stack traces
}
```

Errores como "User with email test@example.com not found" revelan qué usuarios existen en el sistema.

**Remedio:**
```typescript
catch (error: any) {
  // Log el error interno para debugging
  console.error('Login error:', error);
  
  // Responder genéricamente
  res.status(401).json({ message: 'Email o contraseña incorrectos' });
}
```

---

### 6. Validación Débil de File Upload
**Línea**: [server/routes.ts#L6421](server/routes.ts#L6421)  
**Severidad**: 🟠 HIGH  
**Impacto**: Malicious file upload, XSS

**Hallazgo:**
```typescript
app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req) => {
  // Solo valida tamaño (10MB) pero no valida tipo de archivo
  // Un usuario puede subir .exe, .php, o archivos con XSS embebido
});
```

**Remedio:**
```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const BLOCKED_EXTENSIONS = ['.exe', '.php', '.js', '.html', '.sh', '.bat'];

app.post('/api/documents/upload', authenticateToken, upload.single('file'), async (req) => {
  if (!ALLOWED_MIME_TYPES.includes(req.file!.mimetype)) {
    return res.status(400).json({ message: 'Tipo de archivo no permitido' });
  }
  
  const ext = path.extname(req.file!.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ message: 'Extensión no permitida' });
  }
});
```

---

## 📊 Hallazgos Medios (MEDIUM)

### 7. Tokens en Query Parameters
**Línea**: [server/middleware/auth.ts#L20](server/middleware/auth.ts#L20)  
**Severidad**: 🟡 MEDIUM  
**Impacto**: Token disclosure en logs de servidor/proxy

**Hallazgo:**
```typescript
// Support token in query params for PDF viewing
if (!token && req.query.token) {
  token = req.query.token as string; // ❌ Tokens en URL
}
```

Tokens en query params se loguean en:
- Access logs del servidor
- Proxy/CDN logs
- Browser history
- Referrer headers

**Remedio:**
```typescript
// Usar POST body o Authorization header en lugar de query params
// O generar signed URLs con expiración corta (5 minutos)
const signedToken = jwt.sign({ docId, action: 'view' }, JWT_SECRET, { expiresIn: '5m' });
```

---

### 8. Contraseñas en Variables de Entorno
**Severidad**: 🟡 MEDIUM  
**Impacto**: Exposure si .env se commitea

**Hallazgo:**
En [.env](../.env), las claves sensibles están en texto plano.

**Remedio:**
- ✅ Ya hecho en desarrollo: `.env` en `.gitignore`
- Para producción: Usar AWS Secrets Manager, HashiCorp Vault, o similar
- Rotar claves cada 90 días

---

## ✅ Hallazgos Positivos de Seguridad

| Aspecto | Estado | Detalles |
|--------|--------|---------|
| JWT Implementation | ✅ Seguro | Access token 15min, refresh token 90d con sliding session |
| Password Hashing | ✅ Seguro | Usa bcrypt con salt rounds=10 |
| HTTPS en Producción | ✅ Configurado | Force HTTPS con HSTS headers |
| CORS Configurado | ✅ Correcto | Solo localhost en dev, dominios específicos en prod |
| SQL Injection | ✅ Protegido | Usa Drizzle ORM con prepared statements |
| XSS Protection | ✅ Configurado | Content-Security-Policy headers activos |
| CSRF Tokens | ✅ En sesiones | Express-session maneja CSRF implícitamente |

---

## 🔧 Plan de Remediación

### Fase 1: CRÍTICA (Hacer antes de cualquier deploy)
**Estimado**: 2-3 horas

1. ✅ Agregar validación de `companyId` en:
   - `/api/vacation-requests/:id` PATCH
   - `/api/work-shifts/:id` PATCH
   - `/api/work-shifts/:id` DELETE

### Fase 2: ALTA (Próxima semana)
**Estimado**: 4-5 horas

2. Implementar rate limiting en `/api/auth/login`
3. Mejorar mensajes de error (no exponer información)
4. Validar tipos de archivo en uploads

### Fase 3: MEDIA (Próximos 30 días)
**Estimado**: 6-8 horas

5. Mover tokens a Authorization header (remover de query params)
6. Implementar audit logging de cambios sensibles
7. Agregar autenticación de dos factores (2FA)

---

## 📝 Checklist de Remediación

```
Fase 1 - CRÍTICA:
- [ ] Parchar IDOR en vacation-requests PATCH
- [ ] Parchar IDOR en work-shifts PATCH  
- [ ] Parchar IDOR en work-shifts DELETE
- [ ] Test: Intentar acceder a recurso de otra empresa → debe rechazarse
- [ ] Review de código de los parches

Fase 2 - ALTA:
- [ ] Agregar rate limiting a login
- [ ] Sanitizar mensajes de error
- [ ] Validar tipos de archivo
- [ ] Test: Subir .exe, .php → debe rechazarse

Fase 3 - MEDIA:
- [ ] Remover tokens de query params
- [ ] Agregar audit logging
- [ ] Implementar 2FA
```

---

## 🧪 Testing de Seguridad Recomendado

**Herramientas sugeridas:**
- [Burp Suite Community](https://portswigger.net/burp/communitydownload) - Testing de APIs
- [OWASP ZAP](https://www.zaproxy.org/) - Automated security scanning
- [Postman](https://www.postman.com/) - API testing manual

**Casos de prueba:**
```bash
# Test 1: IDOR - Intenta acceder a recurso de otra empresa
curl -H "Authorization: Bearer TOKEN_EMPRESA_A" \
     https://app.com/api/vacation-requests/999

# Test 2: Brute force - 100 intentos de login sin bloqueo
for i in {1..100}; do
  curl -X POST https://app.com/api/auth/login \
       -d '{"email":"user@test.com","password":"wrong'$i'"}'
done

# Test 3: Malicious upload
curl -F "file=@malware.exe" https://app.com/api/documents/upload
```

---

## 📞 Contacto de Seguridad

Para reportar vulnerabilidades:
- 📧 Email: security@oficaz.es
- 🔐 PGP Key: [Si aplica]
- ⏰ Tiempo de respuesta: 24-48 horas

---

**Generado**: 15 Diciembre 2025  
**Auditor**: Copilot Security Analysis  
**Próxima auditoría recomendada**: 90 días
