#!/usr/bin/env pwsh
<#
.SYNOPSIS
Script para construir y ejecutar la app Oficaz Android con todas las configuraciones necesarias

.PARAMETER Command
Comando a ejecutar: build, run, sync, clean, setup
#>

param(
    [Parameter(Position=0)]
    [ValidateSet('build', 'run', 'sync', 'clean', 'setup')]
    [string]$Command = 'build'
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$AndroidDir = Join-Path $ProjectDir "android"

# Funciones auxiliares
function Write-Header {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Set-AndroidEnvironment {
    Write-Step "Configurando variables de ambiente para Android..."
    
    # Java home
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    
    # Verificar Java
    $javaVersion = & java -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Java configurado correctamente"
        Write-Host $javaVersion[0] -ForegroundColor Gray
    } else {
        Write-Error "Java no encontrado. Instala Android Studio."
        exit 1
    }
}

function Invoke-WebBuild {
    Write-Header "🏗️  Construyendo Frontend Web"

    Write-Step "Limpiando build anterior..."
    Remove-Item -Path (Join-Path $ProjectDir "dist") -Recurse -Force -ErrorAction SilentlyContinue

    Write-Step "Construyendo con Vite..."
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error en build de web"
        exit 1
    }

    Write-Success "Frontend compilado correctamente"
}

function Invoke-IconGeneration {
    Write-Header "🎨 Generando Íconos de Android"

    Write-Step "Generando íconos en diferentes resoluciones..."
    & node scripts/generate-icons.cjs

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error generando íconos"
        exit 1
    }

    Write-Success "Íconos generados correctamente"
}

function Sync-AndroidProject {
    Write-Header "🔄 Sincronizando archivos con Android"

    Push-Location $AndroidDir
    try {
        Write-Step "Deteniendo daemon de Gradle..."
        & .\gradlew.bat --stop

        Write-Step "Sincronizando recursos..."
        Push-Location $ProjectDir
        try {
            & npx cap sync android
        }
        finally {
            Pop-Location
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error sincronizando con Android"
            exit 1
        }
    }
    finally {
        Pop-Location
    }

    Write-Success "Android sincronizado correctamente"
}

function Invoke-AndroidBuild {
    Write-Header "📱 Construyendo APK de Android"

    Set-AndroidEnvironment

    Push-Location $AndroidDir
    try {
        Write-Step "Limpiando build anterior..."
        & .\gradlew.bat clean

        Write-Step "Compilando Debug APK..."
        & .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error compilando APK"
            exit 1
        }

        Write-Success "Debug APK generado correctamente"
        Write-Host "📍 Ubicación: $AndroidDir\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
    }
    finally {
        Pop-Location
    }
}

function Invoke-AndroidBundleBuild {
    Write-Header "📦 Construyendo Android App Bundle (AAB)"

    Set-AndroidEnvironment

    Push-Location $AndroidDir
    try {
        Write-Step "Limpiando build anterior..."
        & .\gradlew.bat clean

        Write-Step "Compilando Release Bundle..."
        & .\gradlew.bat bundleRelease

        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error compilando AAB"
            exit 1
        }

        Write-Success "Android App Bundle generado correctamente"
        Write-Host "📍 Ubicación: $AndroidDir\app\build\outputs\bundle\release\app-release.aab" -ForegroundColor Cyan
    }
    finally {
        Pop-Location
    }
}

# Main
switch ($Command) {
    'setup' {
        Write-Header "⚙️  Configuración Inicial"
        Invoke-WebBuild
        Invoke-IconGeneration
        Sync-AndroidProject
        Write-Success "Configuración completada. Ahora ejecuta: ./build-android.ps1 build"
    }

    'build' {
        Invoke-WebBuild
        Invoke-IconGeneration
        Sync-AndroidProject
        Invoke-AndroidBuild
    }

    'sync' {
        Invoke-WebBuild
        Sync-AndroidProject
        Write-Success "Sincronización completada"
    }
    
    'run' {
        Set-AndroidEnvironment
        Push-Location $AndroidDir
        try {
            Write-Step "Instalando APK en emulador..."
            $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
            if (-not (Test-Path $apkPath)) {
                Write-Error "APK no encontrado. Ejecuta './build-android.ps1 build' primero"
                exit 1
            }
            & adb install -r $apkPath
            Write-Success "APK instalado. Abre la app en el emulador."
        }
        finally {
            Pop-Location
        }
    }
    
    'clean' {
        Write-Header "🧹 Limpiando builds"
        Remove-Item -Path (Join-Path $ProjectDir "dist") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $AndroidDir "build") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $AndroidDir "app" "build") -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Builds limpiados"
    }
    
    default {
        Write-Error "Comando desconocido: $Command"
        exit 1
    }
}

Write-Host "`n✨ Operación completada exitosamente" -ForegroundColor Green
