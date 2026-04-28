# 📱 Capacitor Android Setup - Guía Completa

## ✅ Completado hasta ahora:

1. ✅ Instalado Capacitor y dependencias Android
2. ✅ Compilada app web React a `/dist/public/`
3. ✅ Creado archivo `capacitor.config.ts`
4. ✅ Agregada plataforma Android (`/android/`)
5. ✅ Sincronizados web assets a `/android/app/src/main/assets/public/`

---

## 🔴 **ANTES DE CONTINUAR: INSTALA JAVA (Necesario)**

### Opción 1: Con Chocolatey (Recomendado)
Abre PowerShell **COMO ADMINISTRADOR** y ejecuta:

```powershell
choco install openjdk17 -y
```

Luego verifica:
```powershell
java -version
```

Deberías ver algo como:
```
openjdk version "17.0.x"
```

### Opción 2: Descarga manual
- Ve a: https://www.oracle.com/java/technologies/javase-jdk17-downloads.html
- Descarga e instala
- Reinicia PowerShell y verifica con `java -version`

---

## 📥 Descargar e Instalar Android Studio

1. Descarga: https://developer.android.com/studio
2. Ejecuta el instalador
3. **Importante:** Durante la instalación, selecciona:
   - ✅ Android SDK
   - ✅ Android SDK Platform (preferentemente API 34+)
   - ✅ Google Play Services

---

## 🚀 Pasos finales (Desde PowerShell en la carpeta del proyecto):

### Opción A: Abrir en Android Studio automáticamente
```powershell
npx cap open android
```

Se abrirá Android Studio con el proyecto.

### Opción B: Abrir manualmente
1. Abre Android Studio
2. File → Open → Selecciona la carpeta `/android/` del proyecto

---

## 🔨 Compilar la App en Android Studio

Una vez en Android Studio:

1. Espera a que indexe (verás barras de progreso)
2. **Build** (en la barra de menú)
3. **Build Bundle(s) / APK(s)**
4. **Build Bundle(s)** (para Google Play)

El archivo se genera en:
```
android/app/release/app-release.aab
```

O si quieres solo APK para probar en emulador/dispositivo:
4. **Build APK(s)**

El APK se genera en:
```
android/app/release/app-release.apk
```

---

## 📤 Subir a Google Play Store

1. Ve a: https://play.google.com/console
2. Sign in con tu cuenta Google
3. **Create app** → Rellena datos básicos
4. **Release** → **Production** → **Upload bundle**
5. Sube el archivo `.aab`
6. Configura:
   - Screenshots (2-8 imágenes)
   - Descripción de app
   - Imagen de icono (512x512)
   - Contenido (edad, privacidad, etc.)
7. **Enviar a revisión**

**Espera:** Google tarda 24-72 horas en revisar y aprobar.

---

## 📝 Comandos útiles

```powershell
# Compilar web nuevamente (si haces cambios)
npm run build

# Sincronizar cambios web a Android
npx cap sync android

# Apagar y reiniciar emulador
npx cap open android

# Instalar APK en dispositivo conectado (debugging)
adb install android/app/release/app-release.apk
```

---

## ⚙️ Variables de Entorno para Android

Si tu app necesita variables de entorno:

Edita: `android/app/src/main/AndroidManifest.xml`

O usa el archivo `.env` que ya existe en tu proyecto (Capacitor lo carga automáticamente).

---

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Java not found" | Instala OpenJDK17 y reinicia PowerShell |
| "Android SDK not found" | Instala Android Studio completo con SDK |
| "Gradle build failed" | Limpia: `cd android && gradlew clean` |
| "App blanca en inicio" | Verifica que `dist/public/index.html` existe |

---

## 📊 Estructura del Proyecto

```
c:\Oficaz\App\Oficaz\
├── android/              ← Projeto Android (NUEVO)
│   ├── app/
│   ├── gradlew
│   └── build.gradle
├── client/               ← React web app
│   └── src/
├── dist/                 ← Web compilada
│   └── public/
│       └── index.html
├── capacitor.config.ts   ← Configuración (NUEVO)
└── package.json
```

**Tu código React sigue igual, nada cambió.**

---

## ✅ Próximos Pasos

1. Instala Java → `choco install openjdk17 -y`
2. Descarga Android Studio → https://developer.android.com/studio
3. Ejecuta: `npx cap open android`
4. En Android Studio → Build → Build Bundle(s)
5. Sube a Google Play Console

¡Listo! 🎉
