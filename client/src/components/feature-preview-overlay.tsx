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
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 pointer-events-auto">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          <span>Vista previa - Datos de demostración</span>
        </div>
      </div>
    </div>
  );
}

export default FeaturePreviewOverlay;