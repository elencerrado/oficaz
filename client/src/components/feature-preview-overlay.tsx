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
      className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-50 pointer-events-auto"
      onClick={handleClick}
      onMouseDown={handleEvents}
      onMouseUp={handleEvents}
      onTouchStart={handleEvents}
      onTouchEnd={handleEvents}
      onKeyDown={handleEvents}
      onSubmit={handleEvents}
      style={{ zIndex: 9999 }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-md w-full mx-auto text-center pointer-events-auto">
          <div className="mb-4">
            {Icon && <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Funcionalidad no disponible
          </h3>
          <p className="text-gray-600 mb-4">
            Esta funcionalidad no está incluida en tu plan actual.
          </p>
          <p className="text-sm text-gray-500">
            Para acceder a esta función, contacta con tu administrador o actualiza tu plan.
          </p>
        </div>
      </div>
    </div>
  );
}

export default FeaturePreviewOverlay;