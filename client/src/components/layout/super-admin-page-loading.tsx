import { SuperAdminLayout } from './super-admin-layout';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export function SuperAdminPageLoading() {
  return (
    <SuperAdminLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="w-16 h-16 animate-spin dark:brightness-0 dark:invert"
            style={{
              animation: 'spin 1s linear infinite'
            }}
          />
          <p className="text-white/60 text-sm">Cargando...</p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
