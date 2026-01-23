#!/usr/bin/env pwsh
# Pre-Deploy Verification Script
# Ejecutar antes de cada deploy a producción

Write-Host "`n🚀 OFICAZ - Verificación Pre-Deploy`n" -ForegroundColor Cyan

$errors = 0
$warnings = 0

# 1. Verificar TypeScript
Write-Host "📝 Verificando TypeScript..." -ForegroundColor Yellow
$tscOutput = npm run check 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERRORES DE TYPESCRIPT ENCONTRADOS" -ForegroundColor Red
    Write-Host $tscOutput
    $errors++
} else {
    Write-Host "✅ TypeScript OK" -ForegroundColor Green
}

# 2. Verificar Build de Producción
Write-Host "`n🔨 Verificando build de producción..." -ForegroundColor Yellow
$buildOutput = npm run build 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR EN EL BUILD" -ForegroundColor Red
    Write-Host $buildOutput
    $errors++
} else {
    Write-Host "✅ Build exitoso" -ForegroundColor Green
    
    # Verificar tamaño de bundles
    $distSize = (Get-ChildItem -Path "dist/public" -Recurse | Measure-Object -Property Length -Sum).Sum
    $distSizeMB = [math]::Round($distSize / 1MB, 2)
    
    if ($distSizeMB -gt 50) {
        Write-Host "⚠️  Bundle grande: ${distSizeMB}MB (considera optimización)" -ForegroundColor Yellow
        $warnings++
    } else {
        Write-Host "✅ Tamaño del bundle: ${distSizeMB}MB" -ForegroundColor Green
    }
}

# 3. Buscar problemas comunes
Write-Host "`n🔍 Buscando problemas comunes..." -ForegroundColor Yellow

# Buscar console.log en archivos críticos
$consoleLogs = Select-String -Path "client/src/**/*.tsx","client/src/**/*.ts" -Pattern "console\.log" -Exclude "*.test.*","*.spec.*" | Where-Object { $_.Line -notmatch "//" }
if ($consoleLogs.Count -gt 10) {
    Write-Host "⚠️  ${consoleLogs.Count} console.log encontrados (considera limpiar)" -ForegroundColor Yellow
    $warnings++
}

# Buscar uso de 'any' sin @ts-ignore
$anyUsage = Select-String -Path "client/src/**/*.tsx","client/src/**/*.ts" -Pattern ": any" -Exclude "*.test.*","*.spec.*" | Where-Object { $_.Line -notmatch "@ts-" }
if ($anyUsage.Count -gt 50) {
    Write-Host "⚠️  ${anyUsage.Count} usos de 'any' encontrados (revisa tipos)" -ForegroundColor Yellow
    $warnings++
}

# Buscar asignaciones directas peligrosas (.href sin verificación)
$dangerousAssignments = Select-String -Path "client/src/**/*.tsx","client/src/**/*.ts" -Pattern "\.href\s*=\s*\w+;" -Context 1,0
$unsafeCount = 0
foreach ($match in $dangerousAssignments) {
    if ($match.Context.PreContext -notmatch "if\s*\(") {
        $unsafeCount++
    }
}
if ($unsafeCount -gt 0) {
    Write-Host "⚠️  ${unsafeCount} asignaciones potencialmente inseguras encontradas" -ForegroundColor Yellow
    $warnings++
}

# 4. Verificar configuración crítica
Write-Host "`n⚙️  Verificando configuración..." -ForegroundColor Yellow

# Verificar tsconfig.json tiene strict: true
$tsconfigContent = Get-Content "tsconfig.json" -Raw
if ($tsconfigContent -notmatch '"strict":\s*true') {
    Write-Host "❌ tsconfig.json debe tener 'strict: true'" -ForegroundColor Red
    $errors++
} else {
    Write-Host "✅ TypeScript strict mode habilitado" -ForegroundColor Green
}

# 5. Verificar archivos críticos de PDF
Write-Host "`n📄 Verificando configuración de PDF.js..." -ForegroundColor Yellow

$pdfFiles = @(
    "client/src/components/DocumentPreviewModal.tsx",
    "client/src/components/DocumentViewer.tsx",
    "client/src/pages/admin-accounting.tsx"
)

$pdfIssues = 0
foreach ($file in $pdfFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Verificar uso correcto de workerSrc
        if ($content -match "GlobalWorkerOptions\.workerSrc") {
            if ($content -notmatch "legacy/build/pdf\.worker") {
                Write-Host "⚠️  $file: workerSrc no usa legacy build" -ForegroundColor Yellow
                $pdfIssues++
            }
        }
        
        # Verificar que no use disableWorker (deprecado)
        if ($content -match "disableWorker") {
            Write-Host "❌ $file: usa disableWorker (deprecado)" -ForegroundColor Red
            $pdfIssues++
            $errors++
        }
    }
}

if ($pdfIssues -eq 0) {
    Write-Host "✅ Configuración PDF.js correcta" -ForegroundColor Green
}

# Resumen final
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "RESUMEN DE VERIFICACIÓN" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "`n✅ TODO OK - Listo para deploy" -ForegroundColor Green
    exit 0
} elseif ($errors -eq 0) {
    Write-Host "`n⚠️  ${warnings} advertencia(s) encontrada(s)" -ForegroundColor Yellow
    Write-Host "Revisa las advertencias antes de continuar" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "`n❌ ${errors} error(es) CRÍTICO(S) encontrado(s)" -ForegroundColor Red
    Write-Host "⚠️  ${warnings} advertencia(s)" -ForegroundColor Yellow
    Write-Host "`nNO HACER DEPLOY hasta corregir los errores" -ForegroundColor Red
    exit 1
}
