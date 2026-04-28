// Script para ejecutar el fix de las columnas de vacaciones
async function fixVacationColumns() {
  try {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    const response = await fetch('/api/admin/fix-vacation-columns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('✅ Resultado:', result);
    
    if (result.success) {
      alert(`✅ Éxito: ${result.message}\nColumnas añadidas: ${result.columnsAdded.join(', ') || 'ninguna (ya existían)'}`);
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al ejecutar el fix');
  }
}

// Ejecutar
fixVacationColumns();
