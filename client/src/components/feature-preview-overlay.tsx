interface FeaturePreviewOverlayProps {
  Icon: React.ComponentType<{ className?: string }>;
  featureName: string;
  description: string;
  requiredPlan: string;
}

export function FeaturePreviewOverlay({ Icon }: FeaturePreviewOverlayProps) {
  return (
    <div className="absolute inset-0 bg-gray-100/30 z-30 pointer-events-none">
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