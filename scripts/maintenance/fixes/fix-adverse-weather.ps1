# PowerShell script to fix adverse weather absences via API
Write-Host "🔍 Ejecutando diagnóstico de absences..." -ForegroundColor Cyan
Write-Host ""

# Note: This needs to be run while logged in as admin in the browser
# Get auth token from browser console: localStorage.getItem('token')
$token = Read-Host "Pega el token de autenticación (desde localStorage.getItem('token') en la consola del navegador)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "❌ Token requerido. Abre la consola del navegador (F12) y ejecuta: localStorage.getItem('token')" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    # 1. Diagnostic
    Write-Host "📊 Obteniendo diagnóstico..." -ForegroundColor Yellow
    $diagResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/hour-based-absences/diagnostic/check-config" -Method Get -Headers $headers
    
    Write-Host "Working Hours Per Day: $($diagResponse.workingHoursPerDay)" -ForegroundColor White
    Write-Host "Total Absences: $($diagResponse.totalAbsences)" -ForegroundColor White
    Write-Host "Suspicious Absences: $($diagResponse.suspiciousAbsences)" -ForegroundColor White
    Write-Host ""
    
    if ($diagResponse.absences.Count -gt 0) {
        Write-Host "📋 Absences con problemas:" -ForegroundColor Yellow
        foreach ($abs in $diagResponse.absences) {
            Write-Host "  • ID $($abs.id) - $($abs.userName)" -ForegroundColor White
            Write-Host "    Fecha: $($abs.absenceDate)" -ForegroundColor Gray
            Write-Host "    Horas actuales: $($abs.hoursStart)-$($abs.hoursEnd) ($($abs.totalHours)h)" -ForegroundColor Gray
            Write-Host "    Debería ser: 0-$($abs.workingHoursPerDay) ($($abs.workingHoursPerDay)h)" -ForegroundColor Gray
            Write-Host "    Estado: $($abs.status)" -ForegroundColor Gray
            Write-Host ""
        }
        
        # 2. Fix
        Write-Host "🔧 Ejecutando corrección..." -ForegroundColor Cyan
        $fixResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/hour-based-absences/fix/correct-full-days" -Method Post -Headers $headers
        
        Write-Host ""
        Write-Host "✅ CORRECCIÓN COMPLETADA" -ForegroundColor Green
        Write-Host "   $($fixResponse.message)" -ForegroundColor White
        Write-Host "   Absences corregidas: $($fixResponse.correctedCount)" -ForegroundColor White
        Write-Host ""
        Write-Host "🔄 Recarga la página del navegador (F5) para ver los cambios." -ForegroundColor Cyan
    } else {
        Write-Host "✅ No se encontraron absences para corregir. Todo está bien." -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Asegúrate de:" -ForegroundColor Yellow
    Write-Host "1. Estar logueado como admin en el navegador" -ForegroundColor White
    Write-Host "2. El servidor esté corriendo (node start-local.js dev)" -ForegroundColor White
    Write-Host "3. Copiar el token desde la consola del navegador" -ForegroundColor White
}
