# Instalación Local de Oficaz

Esta guía te ayudará a ejecutar Oficaz en tu máquina local (Windows, Mac o Linux).

## Requisitos Previos

- **Node.js 20+** - [Descargar](https://nodejs.org/)
- **PostgreSQL** - Puedes usar [Neon](https://neon.tech) (recomendado) o PostgreSQL local
- **Cuenta de Cloudflare** - Para R2 Object Storage
- **Cuenta de Stripe** - Para pagos

## Pasos de Instalación

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita el archivo .env con tus credenciales
```

### 3. Configurar la Base de Datos

Si usas Neon (recomendado):
1. Crea una cuenta en [neon.tech](https://neon.tech)
2. Crea un nuevo proyecto
3. Copia el connection string y pégalo en `DATABASE_URL`

Luego ejecuta las migraciones:
```bash
npm run db:push
```

### 4. Ejecutar en Desarrollo

**Windows (PowerShell):**
```powershell
npx tsx server/index.ts
```

**Windows (Git Bash / WSL) / Mac / Linux:**
```bash
npx tsx server/index.ts
```

**O usa el script de inicio local:**
```bash
node start-local.js dev
```

### 5. Abrir en el Navegador

Abre [http://localhost:5000](http://localhost:5000)

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `node start-local.js dev` | Desarrollo local con dotenv |
| `node start-local.js` | Ejecutar build de producción |
| `npm run build` | Compilar para producción |
| `npm run db:push` | Aplicar cambios de esquema a la BD |

## Solución de Problemas

### Error: DATABASE_URL must be set
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Usa el comando con `--env-file=.env` o instala dotenv

### Error: Cannot connect to database
- Verifica que la URL de conexión sea correcta
- Si usas Neon, asegúrate de incluir `?sslmode=require`

### Error: STRIPE_SECRET_KEY required
- Añade tus claves de Stripe al archivo `.env`
- Para pruebas, usa las claves de TEST (sk_test_)

### Error: R2 upload failed
- Verifica las credenciales de Cloudflare R2
- Asegúrate de que el bucket existe

## Configuración de Servicios

### Cloudflare R2 (Object Storage)
1. Ve a [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navega a R2 → Create bucket
3. Ve a R2 → Manage R2 API tokens → Create API token
4. Copia Account ID, Access Key ID y Secret Access Key

### Stripe
1. Ve a [dashboard.stripe.com](https://dashboard.stripe.com)
2. Developers → API keys
3. Copia Publishable key y Secret key (usa las de TEST para desarrollo)

### Push Notifications (VAPID)
Genera las claves con:
```bash
npx web-push generate-vapid-keys
```

## Despliegue en Producción

Para desplegar en una VM (DigitalOcean, Hetzner, AWS, etc.):

1. Clona el repositorio en el servidor
2. Copia el archivo `.env` con las credenciales de producción
3. Instala dependencias: `npm install`
4. Compila: `npm run build`
5. Ejecuta: `node start-local.js`
6. Configura nginx como proxy inverso (opcional)

### Ejemplo de configuración nginx:
```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Usar PM2 para mantener la app corriendo:
```bash
npm install -g pm2
pm2 start node --name "oficaz" -- start-local.js
pm2 save
pm2 startup
```
