interface FeaturePreviewOverlayProps {
  Icon: React.ComponentType<{ className?: string }>;
  featureName: string;
  description: string;
  requiredPlan: string;
}

export function FeaturePreviewOverlay({ Icon }: FeaturePreviewOverlayProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const handleEvents = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div 
      className="fixed inset-0 bg-white/40 backdrop-blur-[2px] pointer-events-auto"
      onClick={handleClick}
      onMouseDown={handleEvents}
      onMouseUp={handleEvents}
      onTouchStart={handleEvents}
      onTouchEnd={handleEvents}
      onKeyDown={handleEvents}
      onSubmit={handleEvents}
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-center justify-center h-full p-8">
        <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-lg w-full mx-auto text-center pointer-events-auto">
          {/* Lock icon with gradient background */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            {Icon && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-gray-100">
                <Icon className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
          
          <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-3">
            Funcionalidad Premium
          </h3>
          <p className="text-gray-700 mb-6 leading-relaxed">
            Esta función está disponible en planes superiores. Mejora tu experiencia con funcionalidades avanzadas.
          </p>
          
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
            <p className="text-sm text-gray-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Contacta con tu administrador para más información
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeaturePreviewOverlay;