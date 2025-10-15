import { SuperAdminLayout } from './super-admin-layout';

export function SuperAdminPageLoading() {
  const config = { outerSize: 52, borderWidth: 9, innerSize: 9, gap: 8 };

  return (
    <SuperAdminLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative" style={{ 
          width: `${config.outerSize}px`, 
          height: `${config.outerSize}px` 
        }}>
          {/* Círculo contorno fijo - blanco */}
          <div 
            className="absolute inset-0 rounded-full border-white"
            style={{ borderWidth: `${config.borderWidth}px` }}
          ></div>
          
          {/* Círculo relleno giratorio interno - blanco */}
          <div className="absolute inset-0 animate-spin">
            <div 
              className="absolute bg-white rounded-full"
              style={{
                width: `${config.innerSize}px`,
                height: `${config.innerSize}px`,
                top: `${config.borderWidth}px`,
                left: '50%',
                transform: `translateX(-50%) translateY(${config.gap}px)`
              }}
            ></div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
