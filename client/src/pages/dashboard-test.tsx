import { useAuth } from '@/hooks/use-auth';

export default function DashboardTest() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: 'red', fontSize: '24px', marginBottom: '20px' }}>
        🚨 DASHBOARD TEST - RENDERIZADO BÁSICO
      </h1>
      
      <div style={{ 
        backgroundColor: 'green', 
        color: 'white', 
        padding: '15px', 
        marginBottom: '20px',
        border: '3px solid darkgreen'
      }}>
        ✅ SI VES ESTO, EL RENDERIZADO FUNCIONA
      </div>
      
      <div style={{ 
        backgroundColor: 'blue', 
        color: 'white', 
        padding: '15px', 
        marginBottom: '20px',
        border: '3px solid darkblue'
      }}>
        📊 Usuario: {user?.fullName || 'No definido'}
      </div>
      
      <div style={{ 
        backgroundColor: 'orange', 
        color: 'black', 
        padding: '15px', 
        border: '3px solid darkorange'
      }}>
        🔧 Test completado - Dashboard básico funcionando
      </div>
    </div>
  );
}